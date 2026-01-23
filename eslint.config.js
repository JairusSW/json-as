import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import globals from "globals";

export default defineConfig(
  globalIgnores(["**/node_modules/**", "**/build/**", "**/lib/**", "**/dist/**", "**/*.wasm", "**/*.wat", "assembly/**"]),

  js.configs.recommended,

  tseslint.configs.recommended,

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
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
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
    files: ["bench/runners/**/*.js"],
    languageOptions: {
      globals: {
        readbuffer: "readonly",
        writeFile: "readonly",
        arguments: "readonly",
        ...globals.browser,
      },
    },
    rules: {
      "no-console": "off",
    },
  },

  {
    files: ["bench/**/*.js"],
    rules: {
      "no-console": "off",
    },
  },
);
