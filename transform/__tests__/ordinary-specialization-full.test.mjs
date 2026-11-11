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

const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-ordinary-full-"));
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) for (const strict of ["false", "true"]) {
    const binaries = [];
    for (const enabled of ["false", "true"]) {
      const wasm = path.join(dir, "test.wasm");
      execFileSync(process.execPath, ["node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/ordinary-specialization-full.fixture.ts", "--transform", "./transform",
        "-O3", "-o", wasm, ...(mode === "SIMD" ? ["--enable", "simd"] : [])], {
        cwd: root, env: { ...process.env, JSON_MODE: mode, JSON_STRICT: strict,
          JSON_ACCESS_SPECIALIZATION: enabled }, stdio: "pipe",
      });
      binaries.push(fs.readFileSync(wasm));
    }
    assert.deepEqual(binaries[1], binaries[0], `full-read binary changed: ${mode}/${strict}`);
  }
  console.log("Ordinary specialization: full-read binaries match eager in six configurations");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
