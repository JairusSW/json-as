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
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-static-oracle-"));
const valid = [
  [],
  [""],
  ["a", "b"],
  ['quote"', "slash\\", "line\n", "é", "😀", "\ud800"],
  Array.from({ length: 100 }, (_, i) => i + "x".repeat(64)),
  ["changed"],
  [],
  ["regrown", "values"],
];
const tails = [];
const specialUnits = [
  ...Array.from({ length: 32 }, (_, i) => i),
  34,
  92,
  0x7fff,
  0x8000,
  0xd7ff,
  0xd800,
  0xdbff,
  0xdc00,
  0xdfff,
  0xe000,
  0xffff,
];
for (const length of [
  ...Array.from({ length: 11 }, (_, i) => i + 7),
  23,
  24,
  25,
  31,
  32,
  33,
  63,
  64,
  65,
]) {
  const base = "a".repeat(length);
  tails.push(base);
  for (let at = 0; at < length; at++) {
    for (const code of specialUnits)
      tails.push(
        base.slice(0, at) + String.fromCharCode(code) + base.slice(at + 1),
      );
    tails.push(base.slice(0, at) + "😀" + base.slice(at + 2));
  }
}
valid.push(tails);
const invalid = [
  '["x",]',
  '["x",,"y"]',
  "[1]",
  "[true]",
  '["\\x"]',
  '["\\u00XX"]',
  '["line\nname"]',
  '["unterminated]',
];
let checks = 0;
const decode = (g, p) => {
  const bytes =
    new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff;
  return Buffer.from(g.memory.buffer, p, bytes).toString("utf16le");
};
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const strict of [false, true])
      for (const fast of [false, true]) {
        const wasm = path.join(dir, "static.wasm");
        execFileSync(
          process.execPath,
          [
            path.join(root, "node_modules/assemblyscript/bin/asc.js"),
            "assembly/__tests__/static-string-oracle.fixture.ts",
            "--transform",
            "./transform",
            "--exportRuntime",
            "-O3",
            "-o",
            wasm,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: String(strict),
              JSON_USE_FAST_PATH: fast ? "1" : "0",
              JSON_AS_LIBRARY_SOURCE: "assembly/index",
            },
            stdio: "pipe",
          },
        );
        const g = new WebAssembly.Instance(
          new WebAssembly.Module(fs.readFileSync(wasm)),
          {
            env: {
              abort() {
                throw new Error("Rejected JSON");
              },
            },
          },
        ).exports;
        const call = (source, kind) => {
          const bytes = Buffer.from(source, "utf16le");
          const ptr = g.__pin(g.allocInput(bytes.length));
          new Uint8Array(g.memory.buffer, ptr, bytes.length).set(bytes);
          try {
            return decode(g, g.run(ptr, kind));
          } finally {
            g.__unpin(ptr);
          }
        };
        for (const values of valid)
          for (const space of [undefined, 2])
            for (let kind = 0; kind < 6; kind++) {
              const data = kind >= 3 ? [null, ...values, null] : values;
              const value = kind % 3 === 0 ? data : { items: data };
              const source = JSON.stringify(value, null, space);
              assert.deepEqual(
                JSON.parse(call(source, kind)),
                JSON.parse(source),
                `${mode}/${strict}/${fast}/${kind}`,
              );
              checks++;
            }
        for (const array of invalid)
          for (let kind = 0; kind < 6; kind++) {
            const source = kind % 3 === 0 ? array : '{"items":' + array + "}";
            if (array !== "[1]" && array !== "[true]")
              assert.throws(() => JSON.parse(source));
            assert.throws(
              () => call(source, kind),
              `${mode}/${strict}/${fast}/${kind}: ${source}`,
            );
            checks++;
          }
      }
  console.log(
    `Static string V8/RFC oracle: ${checks} root/field/reuse checks across 12 configurations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
