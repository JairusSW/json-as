// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-entry-"));

try {
  const assemblyDir = path.join(fixtureRoot, "assembly");
  fs.mkdirSync(assemblyDir);
  fs.writeFileSync(
    path.join(assemblyDir, "index.ts"),
    "export function answer(): i32 { return 42; }\n",
  );

  function compile(outputName, extraArgs = []) {
    const outputPath = path.join(fixtureRoot, outputName);
    const result = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, "node_modules/assemblyscript/bin/asc.js"),
        "assembly/index.ts",
        ...extraArgs,
        "--outFile",
        outputPath,
      ],
      { cwd: fixtureRoot, encoding: "utf8" },
    );

    assert.equal(
      result.status,
      0,
      `consumer compilation failed:\n${result.stdout}${result.stderr}`,
    );
    return WebAssembly.Module.exports(
      new WebAssembly.Module(fs.readFileSync(outputPath)),
    ).map(({ name }) => name);
  }

  const controlExports = compile("control.wasm");
  assert.ok(
    controlExports.includes("answer"),
    `control build did not export answer (found: ${controlExports.join(", ")})`,
  );

  const exports = compile("transformed.wasm", [
    "--transform",
    path.join(repoRoot, "transform"),
  ]);
  assert.ok(
    exports.includes("answer"),
    `consumer export was dropped (found: ${exports.join(", ") || "none"})`,
  );
  console.log("  ✓ consumer assembly/index.ts exports remain visible");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
