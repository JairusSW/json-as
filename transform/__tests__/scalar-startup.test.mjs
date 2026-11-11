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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-startup-"));
const eagerRuntime = path.join(root, "assembly/index-startup-eager.tmp.ts");
const eagerFixture = path.join(root, "assembly/__tests__/scalar-startup-eager.tmp.ts");
const runtime = fs.readFileSync(path.join(root, "assembly/index.ts"), "utf8");
const fixture = fs.readFileSync(path.join(root, "assembly/__tests__/scalar-startup.fixture.ts"), "utf8");
try {
  for (const name of ["EMPTY_KEYS", "EMPTY_I32S", "EMPTY_VALS"])
    assert.match(runtime, new RegExp(`@lazy\\s+const ${name}\\b`));
  assert.match(runtime, /@inline\s+function numericCast\b/);
  assert.match(runtime, /@final\s+class LazyRef\b/);
  fs.writeFileSync(eagerRuntime, runtime.replace(/@lazy(?=\s+const EMPTY_(?:KEYS|I32S|VALS)\b)/g, ""));
  fs.writeFileSync(eagerFixture, fixture.replace('"../index"', '"../index-startup-eager.tmp"'));
  const allocations = async (entry, name) => {
    const wasm = path.join(temp, `${name}.wasm`);
    execFileSync(process.execPath, ["node_modules/assemblyscript/bin/asc.js", entry,
      "--transform", "./transform", "--use", "ASC_RTRACE=1", "--exportStart", "start", "-O3", "-o", wasm],
    { cwd: root, stdio: "pipe" });
    let count = 0;
    const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasm), {
      env: { abort() { throw Error("abort"); } },
      rtrace: { oninit() {}, onalloc() { count++; }, onresize() {}, onload: (p) => p,
        onstore: (p) => p, onmove() {}, onfree() {}, onvisit() { return 1; },
        oncollect() {}, oninterrupt() {}, onyield() {} },
    });
    instance.exports.start();
    assert.equal(instance.exports.scalar(), 42);
    return count;
  };
  const lazy = await allocations("assembly/__tests__/scalar-startup.fixture.ts", "lazy");
  const eager = await allocations("assembly/__tests__/scalar-startup-eager.tmp.ts", "eager");
  assert.equal(eager - lazy, 3, `scalar startup: lazy=${lazy}, eager=${eager}`);
  console.log(`Scalar startup: ${lazy} allocations, ${eager} with eager sentinels`);
} finally {
  fs.rmSync(eagerRuntime, { force: true });
  fs.rmSync(eagerFixture, { force: true });
  fs.rmSync(temp, { recursive: true, force: true });
}
