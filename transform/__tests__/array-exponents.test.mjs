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
import { stockArrayExponentData } from "../lib/array-exponents.js";
const root = path.resolve(import.meta.dirname, "../..");
const regenerated = spawnSync(
  process.execPath,
  ["scripts/update-array-exponent-data.mjs", "--check"],
  { cwd: root, encoding: "utf8" },
);
assert.equal(regenerated.status, 0, regenerated.stdout + regenerated.stderr);
const source = fs.readFileSync(
  path.join(root, "node_modules/xjb-as/assembly/xjb.ts"),
  "utf8",
);
const payload = stockArrayExponentData(source);
assert.equal(typeof payload, "string");
assert.equal(payload.length, 32768);
assert.equal(stockArrayExponentData(source + "\n// unknown"), null);
assert.equal(stockArrayExponentData(source), payload);
const bytes = Buffer.from(payload, "utf16le");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-array-exponents-"));
const unsigned = (value) => BigInt.asUintN(64, value);
let checks = 4;
try {
  for (const runtime of ["incremental", "minimal", "stub"]) {
    const output = path.join(dir, "probe.wasm");
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/array-exponents.fixture.ts",
        "--transform",
        "./transform/__tests__/array-exponents-observer.transform.mjs",
        "--runtime",
        runtime,
        "-O3",
        "-o",
        output,
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, JSON_MODE: "SWAR", JSON_CACHE: "0" },
      },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /(?:WARNING|INFO) AS\d+/,
    );
    const g = new WebAssembly.Instance(
      new WebAssembly.Module(fs.readFileSync(output)),
      {
        env: {
          abort() {
            throw Error("abort");
          },
        },
      },
    ).exports;
    for (let index = 0; index < 618; index++) {
      const exponent = index - 293;
      const exact = 10n ** BigInt(Math.abs(exponent));
      const bits = exact.toString(2).length;
      const normalized =
        exponent >= 0
          ? bits <= 128
            ? exact << BigInt(128 - bits)
            : exact >> BigInt(bits - 128)
          : (1n << BigInt(127 + bits)) / exact;
      const low = unsigned(g.low(index)),
        high = unsigned(g.high());
      assert.equal((high << 64n) | low, normalized);
      assert.equal(high >> 63n, 1n);
      checks += 2;
    }
    for (let raw = 0; raw < 2048; raw++)
      for (let slot = 0; slot < 4; slot++) {
        assert.equal(
          unsigned(g.table(raw, slot)),
          unsigned(g.stock(raw, slot)),
          `${runtime}: ${raw}/${slot}`,
        );
        assert.equal(
          unsigned(g.table(raw, slot)),
          bytes.readBigUInt64LE(raw * 32 + slot * 8),
        );
        checks += 2;
      }
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(
  `Array exponents: ${checks} independent stock power/frame/byte and cache checks across three runtimes`,
);
