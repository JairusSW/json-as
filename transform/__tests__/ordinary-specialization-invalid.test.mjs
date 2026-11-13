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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-ordinary-invalid-"));
const generated = path.join(root, "assembly/__tests__/ordinary-specialization-invalid.fixture.tmp.ts");
try {
  let checks = 0;
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) for (const strict of ["false", "true"]) for (const fast of ["0", "1"]) {
    const outcomes = [];
    for (const specialize of ["false", "true"]) {
      const wasm = path.join(dir, "test.wasm");
      const inspect = mode === "SWAR" && strict === "true" && fast === "1" && specialize === "true";
      execFileSync(process.execPath, ["node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/ordinary-specialization-invalid.fixture.ts", "--transform", "./transform",
        "-O3", "-o", wasm, ...(mode === "SIMD" ? ["--enable", "simd"] : [])], { cwd: root, env: { ...process.env, JSON_MODE: mode,
        JSON_ACCESS_SPECIALIZATION: specialize, JSON_STRICT: strict, JSON_USE_FAST_PATH: fast,
        JSON_WRITE: inspect ? "assembly/__tests__/ordinary-specialization-invalid.fixture.ts" : "" }, stdio: "pipe" });
      if (inspect) {
        const output = fs.readFileSync(generated, "utf8");
        assert.ok((output.match(/JSON\.parse<AliasRecord, __JSON_OrdinaryPlan_\d+>/g) || []).length >= 3,
          "all three preserved alias controls must exercise specialized readers");
      }
      const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasm), {
        env: { abort() { throw Error("abort"); } },
      });
      outcomes.push(Array.from({ length: 48 }, (_, i) => {
        try { return { value: i < 8
          ? instance.exports.read(instance.exports.makeInput(i))
          : i < 17 ? instance.exports.readNumeric(instance.exports.makeNumericInput(i - 8))
          : i < 25 ? instance.exports.readNested(instance.exports.makeNestedInput(i - 17))
          : i < 33 ? instance.exports.readNullable(instance.exports.makeInput(i - 25))
          : i < 38 ? instance.exports.readGeneric(instance.exports.makeGenericInput(i - 33))
          : i < 40 ? instance.exports.readGenericArray(instance.exports.makeGenericArrayInput(i - 38))
          : i < 42 ? instance.exports.readAliasFloat(instance.exports.makeAliasInput(i - 40))
          : i < 45 ? instance.exports.readAliasInteger(instance.exports.makeAliasInput(i - 40))
          : instance.exports.readAliasBoolean(instance.exports.makeAliasInput(i - 40)) }; }
        catch { return { error: true }; }
      }));
    }
    assert.deepEqual(outcomes[1], outcomes[0], `${mode} strict=${strict} fast=${fast}`);
    if (strict === "true") for (const i of [40, 42, 43, 45, 46])
      assert.deepEqual(outcomes[1][i], { error: true }, `${mode} strict=${strict} fast=${fast} alias case ${i}`);
    checks += outcomes[0].length;
  }
  console.log(`Ordinary specialization: ${checks} malformed and type-mismatch comparisons passed`);
} finally {
  fs.rmSync(generated, { force: true });
  fs.rmSync(dir, { recursive: true, force: true });
}
