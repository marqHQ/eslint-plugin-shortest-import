import path from "path";
import { ESLintUtils } from "@typescript-eslint/utils";
import { loadConfig, createMatchPath } from "tsconfig-paths";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/you/eslint-plugin-shortest-import#${name}`
);

type Options = [{ tsconfigPath?: string }];

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
            if (aliasSegments < currentSegments) {
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

          if (relativeSegments < currentSegments) {
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
