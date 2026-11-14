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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-integer-oracle-"));
const limit = 1n << 64n;
const values = new Set([0n, 1n, limit - 1n, 1n << 63n, (1n << 32n) - 1n]);
for (let i = 0n; i < 1000n; i++) values.add(i);
for (let power = 1n; power < limit; power *= 10n)
  for (let delta = -5n; delta <= 5n; delta++)
    if (power + delta >= 0n && power + delta < limit) values.add(power + delta);
let seed = 42n;
for (let i = 0; i < 1000; i++) {
  seed = BigInt.asUintN(64, seed * 6364136223846793005n + 1442695040888963407n);
  values.add(seed);
  values.add(seed & 0xffffffffn);
}
let checks = 0;
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of ["incremental", "minimal", "stub"]) {
      const wasm = path.join(dir, "integers.wasm");
      execFileSync(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          "assembly/__tests__/integer-serialization-oracle.fixture.ts",
          "--transform",
          "./transform",
          "--exportRuntime",
          "--runtime",
          runtime,
          "-O3",
          "-o",
          wasm,
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ],
        { cwd: root, env: { ...process.env, JSON_MODE: mode }, stdio: "pipe" },
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
      const decode = (ptr) =>
        Buffer.from(
          g.memory.buffer,
          ptr,
          new DataView(g.memory.buffer).getUint32(ptr - 4, true) & 0x7fffffff,
        ).toString("utf16le");
      let count = 0;
      for (const value of values) {
        const signed = BigInt.asIntN(64, value);
        assert.equal(
          decode(g.signed(value)),
          String(signed),
          `${mode}/${runtime}/signed/${value}`,
        );
        assert.equal(
          decode(g.unsigned(value)),
          String(value),
          `${mode}/${runtime}/unsigned/${value}`,
        );
        const expected = `{"s":${signed},"u":${value},"values":[${signed},${BigInt.asIntN(64, ~value)}]}`;
        assert.equal(
          decode(g.compound(value)),
          expected,
          `${mode}/${runtime}/compound/${value}`,
        );
        checks += 3;
        if (++count % 512 === 0 && runtime !== "stub") g.__collect();
      }
    }
  console.log(
    `Integer serialization oracle: ${checks} exact root/field/array comparisons across nine configurations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
