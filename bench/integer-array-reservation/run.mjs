// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-integer-array-"));
const mode = process.env.JSON_MODE || "SWAR";
const median = (values) => values.sort((a, b) => a - b)[values.length >> 1];

try {
  const wasm = path.join(dir, "fixture.wasm");
  execFileSync(
    process.execPath,
    [
      "node_modules/assemblyscript/bin/asc.js",
      "bench/integer-array-reservation/fixture.ts",
      "--transform",
      "./transform",
      "-O3",
      ...(mode === "SIMD" ? ["--enable", "simd"] : []),
      "-o",
      wasm,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        JSON_MODE: mode,
        JSON_AS_LIBRARY_SOURCE: "assembly/index",
      },
      stdio: "inherit",
    },
  );
  const module = new WebAssembly.Module(fs.readFileSync(wasm));
  for (const [length, value] of [
    [32, 0],
    [1_000_000, 0],
    [1_000_000, 12345],
    [1_000_000, 4294967295],
  ]) {
    const expected = "[" + (value + ",").repeat(length - 1) + value + "]";
    const pages = [];
    const cold = [];
    const warm = [];
    const iterations = length < 100 ? 10_000 : 8;
    for (let sample = 0; sample < 15; sample++) {
      const { exports: e } = new WebAssembly.Instance(module, {
        env: {
          abort: (_msg, _file, line, column) => {
            throw new Error(`abort ${line}:${column}`);
          },
        },
      });
      e.setup(length, value);
      const before = e.memory.buffer.byteLength;
      const start = performance.now();
      const ptr = e.run();
      const firstMs = performance.now() - start;
      const pageGrowthBytes = e.memory.buffer.byteLength - before;
      const bytes = new DataView(e.memory.buffer).getUint32(ptr - 4, true);
      assert.equal(bytes, expected.length * 2);
      assert.equal(
        Buffer.from(e.memory.buffer, ptr, bytes).toString("utf16le"),
        expected,
      );
      for (let i = 0; i < iterations; i++) e.run();
      const warmStart = performance.now();
      for (let i = 0; i < iterations; i++) e.run();
      if (sample >= 3) {
        cold.push(firstMs);
        warm.push((performance.now() - warmStart) / iterations);
        pages.push(pageGrowthBytes / 65536);
      }
    }
    console.log(
      JSON.stringify({
        mode,
        length,
        value,
        firstMs: median(cold),
        warmMs: median(warm),
        pages: median(pages),
      }),
    );
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
