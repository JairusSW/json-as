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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-numeric-getters-"));
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
    const output = path.join(dir, `${mode}.wasm`);
    execFileSync(process.execPath, [
      path.join(root, "node_modules/assemblyscript/bin/asc.js"),
      "assembly/__tests__/dynamic-numeric-conversion.fixture.ts",
      "--transform", "./transform", "-O3", "--noAssert",
      "--use", "ASC_RTRACE=1", "--exportStart", "start",
      ...(mode === "SIMD" ? ["--enable", "simd"] : []), "-o", output,
    ], { cwd: root, env: { ...process.env, JSON_MODE: mode,
      JSON_DIAGNOSTICS: "true", JSON_STRICT: "false",
      JSON_AS_LIBRARY_SOURCE: "assembly/index" }, stdio: "pipe" });
    let allocations = 0;
    const guest = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(output)), {
      env: { abort() { throw new Error("guest abort"); } },
      rtrace: {
        oninit() {}, onalloc() { allocations++; }, onresize() { allocations++; },
        onload: p => p, onstore: p => p, onmove() {}, onfree() {},
        onvisit() { return 1; }, oncollect() {}, oninterrupt() {}, onyield() {},
      },
    }).exports;
    guest.start(); guest.setup(7);
    allocations = 0;
    assert.equal(guest.ints(10000), 70000);
    assert.equal(guest.floats(10000), 75000);
    assert.equal(guest.wides(100), 900719925474100000n);
    assert.equal(guest.convert(10000), 70000);
    assert.equal(allocations, 0, `${mode}: getter loops must not allocate`);
    assert.throws(() => guest.invalid(), /guest abort/);
  }
  console.log("Numeric getters: exact reads, conversions, zero allocations and nonnumeric rejection passed in all 3 modes");
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
