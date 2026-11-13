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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-ordinary-namespace-"));
const generated = path.join(root, "assembly/__tests__/ordinary-namespace-binding.fixture.tmp.ts");
try {
  for (const strict of ["false", "true"]) {
    const outcomes = [];
    for (const enabled of ["false", "true"]) {
      const wasm = path.join(dir, "test.wasm");
      execFileSync(process.execPath, ["node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/ordinary-namespace-binding.fixture.ts", "--transform", "./transform",
        "-O3", "-o", wasm], { cwd: root, env: { ...process.env, JSON_MODE: "SWAR",
        JSON_WRITE: enabled === "true" ? "assembly/__tests__/ordinary-namespace-binding.fixture.ts" : "",
        JSON_STRICT: strict, JSON_ACCESS_SPECIALIZATION: enabled }, stdio: "pipe" });
      if (enabled === "true") {
        const source = fs.readFileSync(generated, "utf8");
        assert.match(source, /JSON\.parse<Parent, __JSON_OrdinaryPlan_\d+>/);
        assert.match(source, /__cursorSkipNative\(srcStart, srcEnd, 4\)/);
        assert.match(source, /__cursorSkipFloatArray\(srcStart, srcEnd\)/);
      }
      const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasm), {
        env: { abort() { throw Error("abort"); } },
      });
      const results = {};
      for (const name of ["valid", "invalid"]) {
        try { results[name] = instance.exports[name](); }
        catch { results[name] = "error"; }
      }
      outcomes.push(results);
    }
    assert.deepEqual(outcomes[1], outcomes[0], `strict=${strict}`);
    assert.equal(outcomes[0].valid, 7);
    if (strict === "true") assert.equal(outcomes[0].invalid, "error");
  }
  console.log("Ordinary specialization: namespace type binding matches eager");
} finally {
  if (fs.existsSync(generated)) fs.unlinkSync(generated);
  fs.rmSync(dir, { recursive: true, force: true });
}
