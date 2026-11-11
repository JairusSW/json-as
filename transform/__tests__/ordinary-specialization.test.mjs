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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-ordinary-"));
const written = path.join(root, "assembly/__tests__/ordinary-specialization.fixture.tmp.ts");
let checks = 0;
try {
  for (const mode of process.env.PROBE_QUICK ? ["SWAR"] : ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of process.env.PROBE_QUICK ? ["incremental"] : ["incremental", "minimal", "stub"])
      for (const strict of process.env.PROBE_QUICK ? [false] : [false, true])
        for (const fast of process.env.PROBE_QUICK ? [true] : [false, true]) {
          const wasm = path.join(dir, "probe.wasm");
          const result = spawnSync(process.execPath, [
            "node_modules/assemblyscript/bin/asc.js",
            "assembly/__tests__/ordinary-specialization.fixture.ts",
            "--transform", "./transform", "--runtime", runtime, "-O3", "-o", wasm,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ], { cwd: root, env: { ...process.env, JSON_MODE: mode,
            JSON_WRITE: checks === 0 ? "assembly/__tests__/ordinary-specialization.fixture.ts" : "",
            JSON_STRATEGIC_LAZINESS: "", JSON_ACCESS_SPECIALIZATION: "true", JSON_STRICT: String(strict),
            JSON_USE_FAST_PATH: fast ? "1" : "0" }, encoding: "utf8" });
          assert.equal(result.status, 0, result.stderr || result.error?.message);
          assert.doesNotMatch(result.stdout + result.stderr, /WARNING AS\d+/);
          if (checks === 0) {
            const generated = fs.readFileSync(written, "utf8");
            assert.match(generated, /JSON\.parse<Record, __JSON_OrdinaryPlan_\d+>\(input\)/);
            assert.match(generated, /function full\(\)[\s\S]*?JSON\.parse<Record>\(input\)/);
            assert.match(generated, /function escape\(\)[\s\S]*?JSON\.parse<Record>\(input\)/);
            assert.match(generated, /function serialized\(\)[\s\S]*?JSON\.parse<Record>\(input\)/);
            assert.match(generated, /JSON\.parse<Child, __JSON_OrdinaryPlan_\d+>/);
            assert.match(generated, /JSON\.parse<DecoratedChild, __JSON_OrdinaryPlan_\d+>/);
            assert.match(generated, /JSON\.parse<GenericChild>\(/);
            assert.match(generated, /JSON\.parse<Scalars, __JSON_OrdinaryPlan_\d+>/);
            assert.match(generated, /JSON\.parse<AliasTypes, __JSON_OrdinaryPlan_\d+>/);
            assert.match(generated, /JSON\.parse<Namespaced\.Data, __JSON_OrdinaryPlan_\d+>/);
            assert.match(generated, /JSON\.parse<ObjectHolder, __JSON_OrdinaryPlan_\d+>/);
            assert.match(generated, /JSON\.parse<NullableHolder, __JSON_OrdinaryPlan_\d+>/);
            assert.match(generated, /JSON\.parse<WideHolder, __JSON_OrdinaryPlan_\d+>/);
            assert.match(generated, /function objectPartialAfterGC\(\)[\s\S]*?JSON\.parse<ObjectHolder, __JSON_OrdinaryPlan_\d+>/);
            assert.match(generated, /JSON\.parse<SharedHolder>\(/);
          }
          let exports;
          const decode = (ptr) => Buffer.from(exports.memory.buffer, ptr,
            new DataView(exports.memory.buffer).getUint32(ptr - 4, true) & 0x7fffffff).toString("utf16le");
          exports = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(wasm)), {
            env: { abort(m, f, l, c) { throw Error(`${decode(m)} (${decode(f)}:${l}:${c})`); } },
          }).exports;
          for (const [name, expected] of Object.entries({ partial: 7, eagerPartial: 7, full: "7:hello:some text",
            escaped: "some text", serialized: '{"id":7,"title":"hello","body":"some text"}', reordered: 8,
            stored: "some text", throughUnchecked: "some text", reused: "8:changed", escapedString: 9,
            nullableString: 10, nullableNull: 11, aliased: 12, aliasTypesPartial: 22, aliasTypesEager: 22, codecEffects: 113,
            inheritedPartial: 14, inheritedFull: "parent:text",
            decoratedInheritedPartial: 15, genericInherited: "16:parent",
            scalarPartial: 17, scalarFull: "17:-9:42:1.25:true", namespaced: 18,
            objectPartial: 19, objectPartialAfterGC: 19, objectEager: 19, objectFull: "19:7:hello:1,2,3",
            nullableObject: 23, nullableObjectNull: 24,
            widePartial: 25, wideEager: 25,
            objectEscaped: '{"id":19,"child":{"value":7,"label":"hello","values":[1,2,3]}}', sharedDefault: "20:0",
            initializerEffects: 11 })) {
            const actual = exports[name]();
            assert.equal(typeof expected === "string" ? decode(actual) : actual, expected,
              `${mode}/${runtime}/${strict}/${fast}/${name}`);
            checks++;
          }
        }
  console.log(`Ordinary specialization: ${checks} checks passed`);
} finally {
  if (fs.existsSync(written)) fs.unlinkSync(written);
  fs.rmSync(dir, { recursive: true, force: true });
}
