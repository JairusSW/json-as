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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-strategic-writer-"));
let checks = 0;
const configs = [];
for (const mode of process.env.PROBE_QUICK
  ? ["SWAR"]
  : ["NAIVE", "SWAR", "SIMD"])
  for (const runtime of process.env.PROBE_QUICK
    ? ["incremental"]
    : ["incremental", "minimal", "stub"])
    for (const strict of process.env.PROBE_QUICK ? [false] : [false, true])
      for (const fast of process.env.PROBE_QUICK ? [true] : [false, true])
        configs.push({ mode, runtime, strict, fast, strategy: "" });
if (!process.env.PROBE_QUICK)
  for (const strict of [false, true])
    configs.push({
      mode: "SWAR",
      runtime: "incremental",
      strict,
      fast: true,
      strategy: "false",
    });
try {
  for (const { mode, runtime, strict, fast, strategy } of configs) {
    const wasm = path.join(dir, "probe.wasm");
    const compiled = spawnSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/strategic-serialization.fixture.ts",
        "--transform",
        "./transform",
        "--runtime",
        runtime,
        "-O3",
        "-o",
        wasm,
        ...(mode === "SIMD" ? ["--enable", "simd"] : []),
      ],
      {
        env: {
          ...process.env,
          JSON_MODE: mode,
          JSON_STRICT: String(strict),
          JSON_USE_FAST_PATH: fast ? "1" : "0",
          JSON_STRATEGIC_LAZINESS: strategy,
          JSON_CACHE: "0",
        },
        encoding: "utf8",
      },
    );
    assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
    assert.doesNotMatch(
      compiled.stdout + compiled.stderr,
      /(?:WARNING|INFO) AS\d+/,
    );
    const g = new WebAssembly.Instance(
      new WebAssembly.Module(fs.readFileSync(wasm)),
      {
        env: {
          abort() {
            throw Error("abort");
          },
        },
      },
    ).exports;
    const decode = (p) =>
      Buffer.from(
        g.memory.buffer,
        p,
        new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
      ).toString("utf16le");
    const eager = strategy === "false" ? 0 : 1;
    const raw = '{"needed":7,"data":9e0,"label":"\\u0061"}';
    const cases = {
      readThenForward: `${eager}:7|${raw}|0:0`,
      aliasForward: `${eager}:7|${raw}|0:0`,
      namespaceForward: `${eager}:7|${raw}|0:0`,
      helperForward: `${eager}:7|${raw}|0:0`,
      replaceFields: '{"needed":11,"data":142,"label":"changed"}|0:1',
      mutateChild: `${eager}:7|{"needed":7,"data":112,"label":"\\u0061"}|1:1`,
      readAfterForward: `${eager}:7|${raw}|{"needed":7,"data":112,"label":"\\u0061"}|1:1`,
      fullRead: `${eager}:17|{"needed":7,"data":109,"label":"a"}|1:1`,
      gcForward: `${eager}:7|${raw}|0:0`,
      reuseForward: `${eager}:8|{"needed":8,"data":12e0,"label":"\\u0062"}|0:0|false`,
      localForwarder: `0:7|${raw}|0:0`,
      hoistedForwarder: `0:7|${raw}|0:0`,
      ordinaryForward: '{"needed":7,"data":109,"label":"a"}|1:1',
      eagerForward: '{"needed":7,"data":109,"label":"a"}|1:1',
      ordinaryScalarForward: '7|{"needed":7,"untouched":"kept"}',
      eagerArrayForward: '7|{"needed":7,"items":[109]}|1:1',
      inheritedForward: `${eager}:7|{"required_id":7,"data":9e0,"label":"\\u0061"}|0:0`,
      omittedForward: '7|{"needed":7,"hide":true}|0:0',
      nestedReadAfterForward:
        '7:7.0|{"needed":7,"child":{"hot":7e0,"cold":9e0}}|{"needed":7,"child":{"hot":7,"cold":9e0}}|0:0',
      globalForward: `${raw}|0:0`,
    };
    for (const [name, expected] of Object.entries(cases)) {
      assert.equal(
        decode(g[name](...(name === "gcForward" ? [9] : []))),
        expected,
        `${mode}/${runtime}/strict=${strict}/fast=${fast}/strategy=${strategy}/${name}`,
      );
      checks++;
    }
  }
  console.log(
    `Strategic serialization: ${checks} eager-plan/raw-forwarding/mutation/codec/GC/reuse/binding checks across ${configs.length} configurations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
