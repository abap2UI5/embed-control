import js from "@eslint/js";
import globals from "globals";

const rules = {
  ...js.configs.recommended.rules,
  "no-unused-vars": [
    "error",
    { caughtErrors: "none", argsIgnorePattern: "^_" },
  ],
  eqeqeq: ["error", "smart"],
  "prefer-const": "error",
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      // the abap2UI5 checkout the e2e job builds its backend from
      ".abap2ui5/**",
      "**/dist/**",
      // the BSP scripts/build-bsp.mjs writes - generated pages
      "out/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  // UI5 modules: the control and the example app, run in the browser
  {
    files: ["packages/*/src/**/*.js", "examples/*/webapp/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, sap: "readonly" },
    },
    rules,
  },
  // the example's dev-server middleware
  {
    files: ["examples/*/lib/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules,
  },
  // tooling
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules,
  },
  // e2e tests - the functions passed to page.evaluate( ) run in the page
  {
    files: ["test/e2e/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, sap: "readonly" },
    },
  },
];
