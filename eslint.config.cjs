const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

const baseRules = {
  "use-isnan": "error",
  "valid-typeof": "error",
};

const esmClientRules = {
  ...baseRules,
  "no-undef": "error",
};

const serverRuntimeRules = {
  ...baseRules,
  "no-undef": "error",
};

module.exports = [
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "client-build/**",
      "bin/r.js",
      "client/js/**",
      "client/js-esm/lib/**",
      "server/js/lib/**",
    ],
  },
  {
    files: ["server/js/**/*.js", "shared/js/**/*.js", "tools/maps/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
    rules: serverRuntimeRules,
  },
  {
    files: ["client/js-esm/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
    },
    rules: esmClientRules,
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2024,
        Bun: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...baseRules,
    },
  },
];
