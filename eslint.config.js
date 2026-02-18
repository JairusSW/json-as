// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "bin/**",
      "templates/**",
      "tests/**/*.js",
      "transform/lib/**",
      "build/**",
      "assembly/**/*.ts",
      "lib/as-bs.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        WebAssembly: "readonly",
        console: "readonly",
        process: "readonly",
      },
    },
  },
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["bench/runners/assemblyscript.js"],
    languageOptions: {
      globals: {
        arguments: "readonly",
        performance: "readonly",
        readbuffer: "readonly",
        writeFile: "readonly",
      },
    },
  },
  {
    files: ["bench/lib/bench.js"],
    languageOptions: {
      globals: {
        performance: "readonly",
        writeFile: "readonly",
      },
    },
  },
);
