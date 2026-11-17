// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

fs.mkdirSync("build", { recursive: true });
const dir = fs.mkdtempSync(path.resolve("build/decimal-clamps-"));
const fixture = path.join(dir, "fixture.ts");
fs.writeFileSync(
  fixture,
  `import {JSON} from "../../assembly/index";
import {__clampProbe,__clampProbeNormal} from "xjb-as/assembly/dtoa";
export {__resetClampProducts as reset,__readClampProducts as count,__readClampSig as sig,__readClampDigit as digit,__readClampHasDigit as hasDigit,__readClampExp as exp} from "xjb-as/assembly/xjb";
export function probe(a:u64,b:u64,c:u64,d:i32,normal:bool):void { if(normal) __clampProbeNormal(a,b,c,d); else __clampProbe(a,b,c,d); }
export function emit(bits:u64,narrow:bool):string { return narrow ? JSON.stringify<f32>(reinterpret<f32>(<u32>bits)) : JSON.stringify<f64>(reinterpret<f64>(bits)); }
`,
);
const max = (1n << 64n) - 1n;
const bias = (1n << 63n) + 6n;
let checks = 0;
try {
  for (const mode of process.env.PROBE_QUICK
    ? ["SWAR"]
    : ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of process.env.PROBE_QUICK
      ? ["incremental"]
      : ["incremental", "minimal", "stub"]) {
      const outputs = [];
      for (const control of ["optimized", "original", "modified"]) {
        const out = path.join(dir, "probe.wasm");
        const compiled = spawnSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            fixture,
            "--transform",
            "./transform/__tests__/decimal-clamps-observer.transform.mjs",
            "--runtime",
            runtime,
            "-O3",
            "-o",
            out,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_CACHE: "0",
              CLAMP_CONTROL: control,
            },
            stdio: "pipe",
          },
        );
        assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
        assert.doesNotMatch(
          compiled.stdout + compiled.stderr,
          /(?:WARNING|INFO) AS\d+/,
        );
        const g = new WebAssembly.Instance(
          new WebAssembly.Module(fs.readFileSync(out)),
          {
            env: {
              abort() {
                throw Error("abort");
              },
            },
          },
        ).exports;
        const text = (p) =>
          Buffer.from(
            g.memory.buffer,
            p,
            new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
          ).toString("utf16le");
        let state = 17n;
        const next = () =>
          (state = BigInt.asUintN(
            64,
            state * 6364136223846793005n + 1442695040888963407n,
          ));
        for (let i = 0; i < 1100; i++)
          for (const normal of [0, 1]) {
            const integral = next(),
              dot = i === 100 ? 1n << 62n : i < 100 ? BigInt(i) : next();
            const half = i <= 100 ? (i % 2 ? max : 0n) : next();
            let one =
              (dot * 10n + (normal && dot === 1n << 62n ? 0n : bias)) >> 64n;
            if (dot < half) one = 0n;
            if (max - dot < half) one = 10n;
            g.reset();
            g.probe(integral, dot, half, -23, normal);
            assert.equal(
              BigInt.asUintN(64, g.sig()),
              BigInt.asUintN(64, integral + (one === 10n ? 1n : 0n)),
            );
            assert.equal(g.digit(), one === 10n ? 0 : Number(one));
            assert.equal(g.hasDigit(), one !== 0n && one !== 10n ? 1 : 0);
            assert.equal(g.exp(), -23);
            const forced = dot < half || max - dot < half;
            assert.equal(
              g.count(),
              control === "optimized" && forced ? 0 : 1,
              `${mode}/${runtime}/${control}/${i}`,
            );
            checks += 5;
          }
        const values = [];
        // Deterministic f32/f64 bit patterns include nonfinite values and both signs.
        for (const bits of [
          0n,
          1n,
          0x8000000000000000n,
          0x0010000000000000n,
          0x7fefffffffffffffn,
          0x7ff0000000000000n,
          ...Array.from({ length: 512 }, next),
        ])
          for (const narrow of [0, 1]) {
            const actual = text(g.emit(bits, narrow));
            values.push(actual);
            const view = new DataView(new ArrayBuffer(8));
            view.setBigUint64(0, bits, true);
            const expected = narrow
              ? view.getFloat32(0, true)
              : view.getFloat64(0, true);
            const parsed = JSON.parse(actual);
            assert.equal(
              narrow && parsed !== null ? Math.fround(parsed) : parsed,
              Number.isFinite(expected)
                ? expected === 0
                  ? 0
                  : expected
                : null,
            );
            checks++;
          }
        outputs.push(values);
      }
      assert.deepEqual(outputs[0], outputs[1]);
      assert.deepEqual(outputs[0], outputs[2]);
      checks += 2;
    }
  console.log(
    `Decimal clamps runtime: ${checks} rounding, precedence, eliminated-product, source-fallback and float-oracle checks passed`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
