/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

/* ESLint configuration for AssemblyScript */

import path from "node:path";
import { createRequire } from "node:module";
import * as ts from "typescript";
import * as parser from "@typescript-eslint/parser";
const PATCH_FLAG = "__json_as_eslint_assemblyscript_patch__";

function isDecoratorPlacementError(error) {
  return (
    error instanceof Error &&
    typeof error.message === "string" &&
    error.message.includes("Decorators are not valid here")
  );
}

function patchDecoratorChecksForAssemblyScript() {
  if (globalThis[PATCH_FLAG]) return;

  try {
    const require = createRequire(import.meta.url);
    const estreePackagePath = require.resolve(
      "@typescript-eslint/typescript-estree/package.json",
    );
    const estreePackageRoot = path.dirname(estreePackagePath);
    const checkModifiers = require(
      path.join(estreePackageRoot, "dist/check-modifiers.js"),
    );

    if (typeof checkModifiers.checkModifiers !== "function") return;

    const originalCheckModifiers = checkModifiers.checkModifiers;
    checkModifiers.checkModifiers = function (node) {
      try {
        return originalCheckModifiers(node);
      } catch (error) {
        if (
          isDecoratorPlacementError(error) &&
          (node.kind === ts.SyntaxKind.FunctionDeclaration ||
            node.kind === ts.SyntaxKind.VariableStatement)
        ) {
          return;
        }
        throw error;
      }
    };

    globalThis[PATCH_FLAG] = true;
  } catch {
    // Ignore when internals are unavailable; linting falls back to default behavior.
  }
}

patchDecoratorChecksForAssemblyScript();

const config = {
  files: ["assembly/**/*.ts","lib/**/*.ts"],
  languageOptions: { parser: parser },
};

export default { config };
