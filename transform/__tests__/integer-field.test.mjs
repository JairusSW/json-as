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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-integer-field-"));
let checks = 0;
try {
  const wasm = path.join(dir, "integer.wasm");
  execFileSync(process.execPath, ["node_modules/assemblyscript/bin/asc.js",
    "transform/__tests__/integer-field.fixture.ts", "--transform", "./transform",
    "-O3", "--enable", "simd", "--exportStart", "start", "-o", wasm], {
    env: { ...process.env, JSON_MODE: "SIMD", JSON_STRICT: "false", JSON_CACHE: "0", JSON_USE_FAST_PATH: "1" },
    stdio: "pipe",
  });
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasm), {
    env: { abort(_m, _f, line, column) { throw Error(`abort ${line}:${column}`); } },
  });
  const g = instance.exports;
  g.start();
  assert.equal(g.api(), 1);
  const start = g.source(), dst = g.destination();
  const words = new Uint16Array(g.memory.buffer, start, 256);
  const expected = new Uint8Array(16);
  // Independent ASCII scanner and integer modulo oracle; no packed digit math.
  function check(backend, units, kind = 3, offset = 0, source = start) {
    const input = new Uint16Array(g.memory.buffer, source, units);
    let cursor = input[0] === 45 ? 1 : 0;
    const first = cursor;
    let value = 0n;
    while (cursor < units && input[cursor] >= 48 && input[cursor] <= 57)
      value = value * 10n + BigInt(input[cursor++] - 48);
    expected.fill(0xcc);
    if (cursor !== first) {
      if (first) value = -value;
      value = BigInt.asUintN(64, value);
      for (let i = 0; i < [1, 2, 4, 8, 8, 4][kind]; i++)
        expected[offset + i] = Number((value >> BigInt(i * 8)) & 255n);
    }
    assert.equal(g.read(backend, kind, source, source + units * 2, offset), cursor === first ? -1 : cursor * 2);
    assert.deepEqual(new Uint8Array(g.memory.buffer, dst, 16), expected);
    checks++;
  }
  for (const backend of [0, 1]) {
    for (const negative of [false, true]) {
      const sign = negative ? 1 : 0;
      if (negative) words[0] = 45;
      for (let lane = 0; lane < 10; lane++) {
        for (let i = 0; i < 10; i++) words[sign + i] = i === 9 ? 44 : 49 + i;
        for (let code = 0; code < 65536; code++) {
          words[sign + lane] = code;
          check(backend, sign + 10, 3, sign);
        }
      }
    }
    let seed = 0x7289634;
    const random = () => seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    for (let test = 0; test < 12000; test++) {
      const length = random() % 129;
      let text = (random() & 1) ? "-" : "";
      for (let i = 0; i < length; i++) text += String.fromCharCode(48 + random() % 10);
      text += ["}", ",", " ", "x", "\u0100", ""][random() % 6];
      for (let i = 0; i < text.length; i++) words[i] = text.charCodeAt(i);
      for (let kind = 0; kind < 6; kind++) check(backend, text.length, kind, test % 9);
    }
    // The logical range ends at the physical end of linear memory.
    for (let count = 0; count < 25; count++) {
      const text = "7".repeat(count), end = g.memory.buffer.byteLength;
      const saved = new Uint8Array(g.memory.buffer, end - 64, 64).slice();
      const source = end - text.length * 2;
      new Uint16Array(g.memory.buffer, source, text.length).fill(55);
      try { check(backend, text.length, 3, 3, source); }
      finally { new Uint8Array(g.memory.buffer, end - 64, 64).set(saved); }
    }
  }
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
    for (const strict of ["false", "true"]) for (const fast of ["0", "1"]) {
      execFileSync(process.execPath, ["node_modules/assemblyscript/bin/asc.js",
        "transform/__tests__/integer-field.fixture.ts", "--transform", "./transform",
        "-O3", "--enable", "simd", "--exportStart", "start", "-o", wasm], {
        env: { ...process.env, JSON_MODE: mode, JSON_STRICT: strict, JSON_CACHE: "0", JSON_USE_FAST_PATH: fast },
        stdio: "pipe",
      });
      const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasm), {
        env: { abort(_m, _f, line, column) { throw Error(`abort ${line}:${column}`); } },
      });
      instance.exports.start();
      assert.equal(instance.exports.api(), 1, `${mode}/${strict}/${fast}`);
    }
  }
  console.log(`Integer field scanner: ${checks} independent oracle checks passed`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
