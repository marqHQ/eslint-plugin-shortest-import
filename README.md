# eslint-plugin-shortest-import

ESLint plugin to prefer the shortest import path, automatically choosing between relative imports and TypeScript path aliases based on which one results in fewer path segments.

## Installation

```bash
npm install eslint-plugin-shortest-import --save-dev
```

## Usage

### ESLint Flat Config (eslint.config.js)

```javascript
import shortestImport from "eslint-plugin-shortest-import";

export default [
  {
    plugins: {
      "shortest-import": shortestImport,
    },
    rules: {
      "shortest-import/shortest-import": "warn",
    },
  },
];
```

### Legacy ESLint Config (.eslintrc)

```json
{
  "plugins": ["shortest-import"],
  "rules": {
    "shortest-import/shortest-import": "warn"
  }
}
```

## Rule Options

```javascript
"shortest-import/shortest-import": ["warn", {
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

## License

MIT
