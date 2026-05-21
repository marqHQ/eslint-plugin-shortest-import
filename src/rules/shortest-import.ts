import path from "path";
import { ESLintUtils } from "@typescript-eslint/utils";
import { loadConfig, createMatchPath } from "tsconfig-paths";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/marqHQ/eslint-plugin-shortest-import#${name}`
);

type TieBreaker =
  | "alias"
  | "relative"
  | "keep"
  | "shortest-first-segment";
type PreferOnTie = TieBreaker | TieBreaker[];
type Options = [{ tsconfigPath?: string; preferOnTie?: PreferOnTie }];

const TIE_BREAKER_VALUES: TieBreaker[] = [
  "alias",
  "relative",
  "keep",
  "shortest-first-segment",
];

export default createRule<Options, "shorterImportAvailable">({
  name: "shortest-import",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer non-relative import only if it has fewer path segments than the relative import",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          tsconfigPath: { type: "string" },
          preferOnTie: {
            oneOf: [
              { type: "string", enum: TIE_BREAKER_VALUES },
              {
                type: "array",
                items: { type: "string", enum: TIE_BREAKER_VALUES },
              },
            ],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      shorterImportAvailable:
        'A shorter import path is available: "{{shorter}}" ({{shorterCount}} segments vs {{currentCount}})',
    },
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const filename = context.filename;
    const fileDir = path.dirname(filename);
    const tieChain: TieBreaker[] = Array.isArray(options.preferOnTie)
      ? options.preferOnTie
      : [options.preferOnTie ?? "keep"];

    // Load tsconfig paths
    const tsconfigPath =
      options.tsconfigPath ?? path.join(process.cwd(), "tsconfig.json");
    const config = loadConfig(tsconfigPath);

    if (config.resultType === "failed") {
      return {}; // No tsconfig paths, nothing to do
    }

    const { absoluteBaseUrl, paths } = config;
    const matchPath = createMatchPath(absoluteBaseUrl, paths);

    // Build reverse mapping: absolute path -> alias
    const aliasMap = buildAliasMap(absoluteBaseUrl, paths);

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;

        const isRelative = source.startsWith(".");
        const currentSegments = countSegments(source);

        if (isRelative) {
          // Relative import: check if an alias would be shorter
          const absolutePath = path.resolve(fileDir, source);
          const aliasImport = findShortestAlias(
            absolutePath,
            absoluteBaseUrl,
            aliasMap
          );

          if (aliasImport) {
            const aliasSegments = countSegments(aliasImport);
            const shouldReport =
              aliasSegments < currentSegments ||
              (aliasSegments === currentSegments &&
                resolveTie(aliasImport, source, tieChain) === "alias");

            if (shouldReport) {
              context.report({
                node: node.source,
                messageId: "shorterImportAvailable",
                data: {
                  shorter: aliasImport,
                  shorterCount: String(aliasSegments),
                  currentCount: String(currentSegments),
                },
                fix(fixer) {
                  return fixer.replaceText(node.source, `"${aliasImport}"`);
                },
              });
            }
          }
        } else {
          // Non-relative (alias) import: check if relative would be shorter
          const extensions = [".ts", ".tsx", ".js", ".jsx", ""];
          const resolved = matchPath(source, undefined, undefined, extensions);
          if (!resolved) return;

          const relativeImport = toRelativeImport(fileDir, resolved);
          const relativeSegments = countSegments(relativeImport);
          const shouldReport =
            relativeSegments < currentSegments ||
            (relativeSegments === currentSegments &&
              resolveTie(source, relativeImport, tieChain) === "relative");

          if (shouldReport) {
            context.report({
              node: node.source,
              messageId: "shorterImportAvailable",
              data: {
                shorter: relativeImport,
                shorterCount: String(relativeSegments),
                currentCount: String(currentSegments),
              },
              fix(fixer) {
                return fixer.replaceText(node.source, `"${relativeImport}"`);
              },
            });
          }
        }
      },
    };
  },
});

// Walks the tie-breaker chain until one returns "alias" or "relative".
// `"keep"` (or end-of-chain) yields null = don't flag. `"shortest-first-segment"`
// can fall through to the next breaker when first segments are equal length.
function resolveTie(
  aliasImport: string,
  relativeImport: string,
  chain: TieBreaker[]
): "alias" | "relative" | null {
  for (const breaker of chain) {
    if (breaker === "keep") return null;
    if (breaker === "alias") return "alias";
    if (breaker === "relative") return "relative";
    if (breaker === "shortest-first-segment") {
      const aLen = firstSegment(aliasImport).length;
      const rLen = firstSegment(relativeImport).length;
      if (aLen < rLen) return "alias";
      if (rLen < aLen) return "relative";
      // first segments are equal length — fall through to next breaker
    }
  }
  return null;
}

// On a segment-count tie, the two import forms always have an identical tail —
// the only difference is the first segment (alias prefix like `@` / `@foo` vs
// the relative `..`). Comparing first-segment length captures the intuition
// that short alias prefixes are "free" while long ones add visual noise.
function firstSegment(importPath: string): string {
  const segments = importPath
    .replace(/^\.\//, "")
    .split("/")
    .filter((s) => s && s !== ".");
  return segments[0] ?? "";
}

function countSegments(importPath: string): number {
  // Count meaningful segments - each directory level counts
  // "./foo" = 1, "../bar/baz" = 3 (.. + bar + baz)
  // "@/components/Button" = 2 (@/ is the alias prefix, then components/Button)
  // "@components/Button" = 2 (@components is the alias prefix, then Button)
  const segments = importPath
    .replace(/^\.\//, "") // remove leading ./
    .split("/")
    .filter((s) => s && s !== "."); // filter empty and current-dir, but keep ..

  return segments.length;
}

function buildAliasMap(
  baseUrl: string,
  paths: Record<string, string[]>
): Map<string, string> {
  // Map from resolved directory/file pattern to alias prefix
  const map = new Map<string, string>();

  for (const [alias, targets] of Object.entries(paths)) {
    for (const target of targets) {
      // Remove trailing /* for directory aliases
      const cleanAlias = alias.replace(/\/\*$/, "");
      const cleanTarget = target.replace(/\/\*$/, "");
      const absoluteTarget = path.resolve(baseUrl, cleanTarget);
      map.set(absoluteTarget, cleanAlias);
    }
  }

  return map;
}

function findShortestAlias(
  absolutePath: string,
  _baseUrl: string,
  aliasMap: Map<string, string>
): string | null {
  // Normalize the path (remove extension for matching)
  const normalized = absolutePath.replace(/\.(ts|tsx|js|jsx)$/, "");

  let shortestAlias: string | null = null;
  let shortestSegments = Infinity;

  for (const [targetPath, aliasPrefix] of aliasMap) {
    if (normalized.startsWith(targetPath)) {
      const remainder = normalized.slice(targetPath.length);
      let aliasImport = aliasPrefix + remainder;
      // Clean up: remove trailing /index
      aliasImport = aliasImport.replace(/\/index$/, "");

      const segments = countSegments(aliasImport);
      if (segments < shortestSegments) {
        shortestSegments = segments;
        shortestAlias = aliasImport;
      }
    }
  }

  return shortestAlias;
}

function toRelativeImport(fromDir: string, toAbsolute: string): string {
  let relative = path.relative(fromDir, toAbsolute);

  // Ensure it starts with ./ or ../
  if (!relative.startsWith(".")) {
    relative = "./" + relative;
  }

  // Remove extension
  relative = relative.replace(/\.(ts|tsx|js|jsx)$/, "");

  // Remove trailing /index
  relative = relative.replace(/\/index$/, "");

  return relative;
}
