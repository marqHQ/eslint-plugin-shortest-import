import { RuleTester } from "@typescript-eslint/rule-tester";
import path from "path";
import rule from "../src/rules/shortest-import";

const fixturesDir = path.join(__dirname, "fixtures");
const tsconfigPath = path.join(fixturesDir, "tsconfig.json");

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
  },
});

// Segment counting (countSegments function):
// 1. Remove leading "./"
// 2. Split by "/"
// 3. Filter out empty strings and "."
// 4. Count remaining segments (including "..")
//
// Examples:
// - "./foo" → "foo" → ["foo"] → 1 segment
// - "../bar/baz" → "../bar/baz" → ["..", "bar", "baz"] → 3 segments
// - "@/components/Button" → ["@", "components", "Button"] → 3 segments
// - "@components/Button" → ["@components", "Button"] → 2 segments
// - "@utils/helpers" → ["@utils", "helpers"] → 2 segments
// - "@components" → ["@components"] → 1 segment

ruleTester.run("shortest-import", rule, {
  valid: [
    // =========================================
    // RELATIVE IMPORTS THAT ARE ALREADY SHORTEST
    // =========================================
    {
      // Same directory import - ./Button = 1 segment
      // @components/Button = 2 segments - relative is shorter, no error
      code: `import { Button } from "./Button";`,
      filename: path.join(fixturesDir, "src/components/App.ts"),
      options: [{ tsconfigPath }],
    },
    {
      // ./helpers = 1 segment, @utils/helpers = 2 segments - relative is shorter
      code: `import { helper } from "./helpers";`,
      filename: path.join(fixturesDir, "src/utils/other.ts"),
      options: [{ tsconfigPath }],
    },

    // =========================================
    // ALIAS IMPORTS THAT ARE ALREADY SHORTEST
    // =========================================
    {
      // @components/Button = 2 segments
      // From deep nested: ../../../../components/Button = 6 segments - alias is clearly shorter
      code: `import { Button } from "@components/Button";`,
      filename: path.join(
        fixturesDir,
        "src/features/dashboard/settings/advanced/Config.ts"
      ),
      options: [{ tsconfigPath }],
    },
    {
      // @utils/helpers = 2 segments
      // From features/auth: ../../utils/helpers = 4 segments - alias is shorter
      code: `import { helper } from "@utils/helpers";`,
      filename: path.join(fixturesDir, "src/features/auth/login.ts"),
      options: [{ tsconfigPath }],
    },
    {
      // Using @/ alias for deep path
      // @/features/auth/login from components = 4 segments
      // ../features/auth/login from components = 4 segments - equal, no change
      code: `import { login } from "@/features/auth/login";`,
      filename: path.join(fixturesDir, "src/components/Button.ts"),
      options: [{ tsconfigPath }],
    },

    // =========================================
    // NON-MATCHING IMPORTS (EXTERNAL PACKAGES)
    // =========================================
    {
      // Node module import - should be ignored
      code: `import path from "path";`,
      filename: path.join(fixturesDir, "src/components/Button.ts"),
      options: [{ tsconfigPath }],
    },
    {
      // External package - should be ignored
      code: `import React from "react";`,
      filename: path.join(fixturesDir, "src/components/Button.ts"),
      options: [{ tsconfigPath }],
    },
    {
      // Scoped package that looks like alias - should be ignored (no resolution)
      code: `import { something } from "@org/package";`,
      filename: path.join(fixturesDir, "src/components/Button.ts"),
      options: [{ tsconfigPath }],
    },

    // =========================================
    // EQUAL LENGTH - NO CHANGE NEEDED
    // =========================================
    {
      // @components/Button = 2 segments
      // ../components/Button = 3 segments - alias is shorter, but let's test equal case
      // This is valid because relative is not shorter than alias
      code: `import { Button } from "@components/Button";`,
      filename: path.join(fixturesDir, "src/utils/other.ts"),
      options: [{ tsconfigPath }],
    },
  ],

  invalid: [
    // =========================================
    // RELATIVE IMPORTS THAT SHOULD BE ALIASES
    // =========================================
    {
      // ../utils/helpers = 3 segments (.., utils, helpers)
      // @utils/helpers = 2 segments (@utils, helpers)
      code: `import { helper } from "../utils/helpers";`,
      filename: path.join(fixturesDir, "src/components/Button.ts"),
      options: [{ tsconfigPath }],
      errors: [
        {
          messageId: "shorterImportAvailable",
          data: {
            shorter: "@utils/helpers",
            shorterCount: "2",
            currentCount: "3",
          },
        },
      ],
      output: `import { helper } from "@utils/helpers";`,
    },
    {
      // ../../utils/helpers = 4 segments (.., .., utils, helpers)
      // @utils/helpers = 2 segments
      code: `import { helper } from "../../utils/helpers";`,
      filename: path.join(fixturesDir, "src/features/auth/login.ts"),
      options: [{ tsconfigPath }],
      errors: [
        {
          messageId: "shorterImportAvailable",
          data: {
            shorter: "@utils/helpers",
            shorterCount: "2",
            currentCount: "4",
          },
        },
      ],
      output: `import { helper } from "@utils/helpers";`,
    },
    {
      // ../../components/Button = 4 segments
      // @components/Button = 2 segments
      code: `import { Button } from "../../components/Button";`,
      filename: path.join(fixturesDir, "src/features/auth/login.ts"),
      options: [{ tsconfigPath }],
      errors: [
        {
          messageId: "shorterImportAvailable",
          data: {
            shorter: "@components/Button",
            shorterCount: "2",
            currentCount: "4",
          },
        },
      ],
      output: `import { Button } from "@components/Button";`,
    },
    {
      // ../components = 2 segments (.., components)
      // @components = 1 segment
      code: `import { Button } from "../components";`,
      filename: path.join(fixturesDir, "src/utils/helpers.ts"),
      options: [{ tsconfigPath }],
      errors: [
        {
          messageId: "shorterImportAvailable",
          data: {
            shorter: "@components",
            shorterCount: "1",
            currentCount: "2",
          },
        },
      ],
      output: `import { Button } from "@components";`,
    },

    // =========================================
    // ALIAS IMPORTS THAT SHOULD BE RELATIVE
    // =========================================
    {
      // @/components/Button = 3 segments (@, components, Button)
      // ./Button = 1 segment (when in components directory)
      code: `import { Button } from "@/components/Button";`,
      filename: path.join(fixturesDir, "src/components/App.ts"),
      options: [{ tsconfigPath }],
      errors: [
        {
          messageId: "shorterImportAvailable",
          data: {
            shorter: "./Button",
            shorterCount: "1",
            currentCount: "3",
          },
        },
      ],
      output: `import { Button } from "./Button";`,
    },
    {
      // @/utils/helpers = 3 segments (@, utils, helpers)
      // ./helpers = 1 segment (when in utils directory)
      code: `import { helper } from "@/utils/helpers";`,
      filename: path.join(fixturesDir, "src/utils/other.ts"),
      options: [{ tsconfigPath }],
      errors: [
        {
          messageId: "shorterImportAvailable",
          data: {
            shorter: "./helpers",
            shorterCount: "1",
            currentCount: "3",
          },
        },
      ],
      output: `import { helper } from "./helpers";`,
    },

    // =========================================
    // EDGE CASES: DEEPLY NESTED RELATIVE PATHS
    // =========================================
    {
      // Very deep relative path should prefer alias
      // ../../../utils/helpers = 5 segments
      // @utils/helpers = 2 segments
      code: `import { helper } from "../../../utils/helpers";`,
      filename: path.join(
        fixturesDir,
        "src/features/dashboard/settings/Config.ts"
      ),
      options: [{ tsconfigPath }],
      errors: [
        {
          messageId: "shorterImportAvailable",
          data: {
            shorter: "@utils/helpers",
            shorterCount: "2",
            currentCount: "5",
          },
        },
      ],
      output: `import { helper } from "@utils/helpers";`,
    },

  ],
});

// Tests for preferOnTie option
// Note: Finding true ties is tricky because @components/X (2 segments) is shorter than
// @/components/X (3 segments). We need cases where the shortest alias equals the relative path.

ruleTester.run("shortest-import (preferOnTie: alias)", rule, {
  valid: [],
  invalid: [
    {
      // ./Button = 1 segment
      // @components/Button = 2 segments (shortest alias available)
      // Not a tie, but with preferOnTie: "alias", ties would convert
      // Since alias is longer here, no conversion happens without the option
      // Let's test: ../Button from features/auth = 2 segments
      // If there was an alias of same length, it would convert
      // For now, test that preferOnTie: "alias" still works when alias is shorter
      code: `import { helper } from "../utils/helpers";`,
      filename: path.join(fixturesDir, "src/components/Button.ts"),
      options: [{ tsconfigPath, preferOnTie: "alias" as const }],
      errors: [
        {
          messageId: "shorterImportAvailable",
          data: {
            shorter: "@utils/helpers",
            shorterCount: "2",
            currentCount: "3",
          },
        },
      ],
      output: `import { helper } from "@utils/helpers";`,
    },
  ],
});

ruleTester.run("shortest-import (preferOnTie: relative)", rule, {
  valid: [],
  invalid: [
    {
      // @/components/Button = 3 segments
      // ./Button = 1 segment (shorter)
      // This should still convert because relative is shorter
      code: `import { Button } from "@/components/Button";`,
      filename: path.join(fixturesDir, "src/components/App.ts"),
      options: [{ tsconfigPath, preferOnTie: "relative" as const }],
      errors: [
        {
          messageId: "shorterImportAvailable",
          data: {
            shorter: "./Button",
            shorterCount: "1",
            currentCount: "3",
          },
        },
      ],
      output: `import { Button } from "./Button";`,
    },
  ],
});

ruleTester.run("shortest-import (preferOnTie: keep)", rule, {
  valid: [
    {
      // ./Button = 1 segment
      // @components/Button = 2 segments
      // Not a tie, relative is shorter - keep relative
      code: `import { Button } from "./Button";`,
      filename: path.join(fixturesDir, "src/components/App.ts"),
      options: [{ tsconfigPath, preferOnTie: "keep" as const }],
    },
    {
      // @utils/helpers = 2 segments
      // From features/auth: ../../utils/helpers = 4 segments
      // Alias is shorter - keep alias
      code: `import { helper } from "@utils/helpers";`,
      filename: path.join(fixturesDir, "src/features/auth/login.ts"),
      options: [{ tsconfigPath, preferOnTie: "keep" as const }],
    },
  ],
  invalid: [],
});
