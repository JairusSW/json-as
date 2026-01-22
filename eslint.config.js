import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/lib/**",
      "**/dist/**",
      "**/*.wasm",
      "**/*.wat",
      "assembly/**",
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ["transform/src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./transform/tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",

      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  {
    files: ["**/*.js", "**/*.mjs"],
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    files: ["bench/**/*.js"],
    rules: {
      "no-console": "off",
    },
  },
);
