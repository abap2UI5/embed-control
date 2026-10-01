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
      // the checkouts the samples job runs: abap2UI5, which it builds its
      // backend from, and abap2UI5/samples-embed-control
      ".abap2ui5/**",
      ".samples/**",
      "**/dist/**",
    ],
  },
  // UI5 modules: the control, run in the browser
  {
    files: ["packages/*/src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, sap: "readonly" },
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
];
