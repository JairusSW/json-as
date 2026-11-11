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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-ordinary-alloc-"));
try {
  for (const strict of ["false", "true"]) for (const fast of ["0", "1"]) {
    const wasm = path.join(dir, "test.wasm");
    execFileSync(process.execPath, ["node_modules/assemblyscript/bin/asc.js",
      "assembly/__tests__/ordinary-specialization.fixture.ts", "--transform", "./transform",
      "--use", "ASC_RTRACE=1", "--exportStart", "start", "-O3", "-o", wasm],
    { cwd: root, env: { ...process.env, JSON_MODE: "SWAR", JSON_STRICT: strict,
      JSON_ACCESS_SPECIALIZATION: "true", JSON_USE_FAST_PATH: fast }, stdio: "pipe" });
    let count = 0;
    const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasm), {
      env: { abort(_m, _f, l, c) { throw Error(`abort ${l}:${c}`); } },
      rtrace: { oninit() {}, onalloc() { count++; }, onresize() {}, onload: (p) => p,
        onstore: (p) => p, onmove() {}, onfree() {}, onvisit() { return 1; },
        oncollect() {}, oninterrupt() {}, onyield() {} },
    });
    instance.exports.start();
    instance.exports.partial();
    instance.exports.eagerPartial();
    count = 0;
    assert.equal(instance.exports.partial(), 7);
    const specialized = count;
    count = 0;
    assert.equal(instance.exports.eagerPartial(), 7);
    const eager = count;
    assert.ok(specialized < eager,
      `strict=${strict} fast=${fast}: specialized=${specialized}, eager=${eager}`);
    instance.exports.objectPartial();
    instance.exports.objectEager();
    count = 0;
    assert.equal(instance.exports.objectPartial(), 19);
    const objectSpecialized = count;
    count = 0;
    assert.equal(instance.exports.objectEager(), 19);
    const objectEager = count;
    assert.ok(objectSpecialized < objectEager,
      `object strict=${strict} fast=${fast}: specialized=${objectSpecialized}, eager=${objectEager}`);
    instance.exports.aliasTypesPartial();
    instance.exports.aliasTypesEager();
    count = 0;
    assert.equal(instance.exports.aliasTypesPartial(), 22);
    const aliasSpecialized = count;
    count = 0;
    assert.equal(instance.exports.aliasTypesEager(), 22);
    const aliasEager = count;
    assert.ok(aliasSpecialized < aliasEager,
      `alias strict=${strict} fast=${fast}: specialized=${aliasSpecialized}, eager=${aliasEager}`);
    instance.exports.widePartial();
    instance.exports.wideEager();
    count = 0;
    assert.equal(instance.exports.widePartial(), 25);
    const wideSpecialized = count;
    count = 0;
    assert.equal(instance.exports.wideEager(), 25);
    const wideEager = count;
    assert.ok(wideSpecialized < wideEager,
      `wide strict=${strict} fast=${fast}: specialized=${wideSpecialized}, eager=${wideEager}`);
  }
  console.log("Ordinary specialization: allocation reduction verified in four configurations");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
