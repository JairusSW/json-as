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

const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-path-limit-"));
try {
  for (const enabled of [false, true]) {
    const wasm = path.join(dir, `${enabled}.wasm`);
    const result = spawnSync(process.execPath, ["node_modules/assemblyscript/bin/asc.js",
      "assembly/__tests__/access-path-limit.fixture.ts", "--transform", "./transform",
      "--runtime", "stub", "-O0", "-o", wasm], {
      cwd: root, env: { ...process.env, JSON_ACCESS_SPECIALIZATION: String(enabled) },
      encoding: "utf8", timeout: 60000,
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const instance = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(wasm)), {
      env: { abort() { throw Error("abort"); } },
    });
    assert.equal(instance.exports.guarded(0), 42);
    assert.equal(instance.exports.guarded(3), 0);
    assert.equal(instance.exports.helperGraph(), 14680064);
  }
  console.log("Access path limit: compiler and eager fallback passed");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
