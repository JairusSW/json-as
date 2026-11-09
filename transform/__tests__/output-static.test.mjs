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
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-static-output-"));
let checks = 0;
try {
  for (const runtime of ["incremental", "minimal", "stub"]) {
    for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
      const output = path.join(dir, `${runtime}-${mode}.wasm`);
      execFileSync(process.execPath, [
        path.join(root, "node_modules/assemblyscript/bin/asc.js"),
        "assembly/__tests__/output-static.fixture.ts",
        "--transform", "./transform", "--runtime", runtime,
        "-O3", "--noAssert", "--uncheckedBehavior", "always",
        ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        "-o", output,
      ], {
        cwd: root,
        env: { ...process.env, JSON_MODE: mode, JSON_STRICT: "false", JSON_USE_FAST_PATH: "1", JSON_AS_LIBRARY_SOURCE: "assembly/index" },
        stdio: "pipe",
      });
      const module = new WebAssembly.Module(fs.readFileSync(output));
      for (let kind = 0; kind < 13; kind++) {
        // Literal corruption must not contaminate later cases. Guest checks
        // use owned copies, not identically interned expectation literals.
        const guest = new WebAssembly.Instance(module, {
          env: { abort(_message, _file, line, column) { throw new Error(`guest abort ${line}:${column}`); } },
        }).exports;
        assert.equal(guest.run(kind), 0, `${runtime}/${mode}/case ${kind}`);
        checks++;
      }
    }
  }
  console.log(`Static output destinations: ${checks} checks passed`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
