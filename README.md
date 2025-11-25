# eslint-plugin-shortest-import

ESLint plugin to prefer the shortest import path, automatically choosing between relative imports and TypeScript path aliases based on which one results in fewer path segments.

## Installation

```bash
npm install @marqhq/eslint-plugin-shortest-import --save-dev
```

## Usage

### ESLint Flat Config (eslint.config.js)

```javascript
import shortestImport from "@marqhq/eslint-plugin-shortest-import";

export default [
  {
    plugins: {
      "@marqhq/shortest-import": shortestImport,
    },
    rules: {
      "@marqhq/shortest-import/shortest-import": "warn",
    },
  },
];
```

### Legacy ESLint Config (.eslintrc)

```json
{
  "plugins": ["@marqhq/shortest-import"],
  "rules": {
    "@marqhq/shortest-import/shortest-import": "warn"
  }
}
```

## Rule Options

```javascript
"@marqhq/shortest-import/shortest-import": ["warn", {
  "tsconfigPath": "./tsconfig.json" // Optional: path to tsconfig.json
}]
```

## How It Works

The rule compares the "segment count" of import paths:

- `./Button` = 1 segment
- `../utils/helpers` = 3 segments (`..`, `utils`, `helpers`)
- `@components/Button` = 2 segments (`@components`, `Button`)
- `@/components/Button` = 3 segments (`@`, `components`, `Button`)

The rule suggests switching to whichever form has fewer segments.

### Examples

Given this `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"],
      "@components/*": ["./components/*"],
      "@utils/*": ["./utils/*"]
    }
  }
}
```

#### Relative to Alias (when alias is shorter)

```typescript
// File: src/features/auth/login.ts

// Bad - 4 segments
import { Button } from "../../components/Button";

// Good - 2 segments
import { Button } from "@components/Button";
```

#### Alias to Relative (when relative is shorter)

```typescript
// File: src/components/App.ts

// Bad - 3 segments
import { Button } from "@/components/Button";

// Good - 1 segment
import { Button } from "./Button";
```

## Auto-fix

This rule supports ESLint's `--fix` option to automatically convert imports to the shorter form.

```bash
eslint --fix src/
```

## Requirements

- ESLint >= 8.0.0
- TypeScript >= 4.0.0
- A `tsconfig.json` with `paths` configured

## Development

### Setup

```bash
npm install
npm run build
npm test
```

### Releasing

To publish a new version:

1. Update the version in `package.json`
2. Commit the change: `git commit -am "Bump version to x.x.x"`
3. Create and push a tag: `git tag vx.x.x && git push origin vx.x.x`
4. Create a GitHub release: `gh release create vx.x.x --title "vx.x.x" --notes "Release notes here"`

The GitHub Action will automatically build, test, and publish to GitHub Packages.

## License

MIT
