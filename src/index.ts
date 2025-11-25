import shortestImport from "./rules/shortest-import";

const plugin = {
  meta: {
    name: "@marqhq/eslint-plugin-shortest-import",
    version: "1.0.0",
  },
  rules: {
    "shortest-import": shortestImport,
  },
  configs: {
    recommended: {
      plugins: ["@marqhq/shortest-import"],
      rules: {
        "@marqhq/shortest-import/shortest-import": "warn",
      },
    },
  },
};

export = plugin;
