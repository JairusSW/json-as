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
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-v8-oracle-"));
const cases = [];
const add = (kind, value) => {
  for (const space of [undefined, 2])
    cases.push([kind, JSON.stringify(value, null, space)]);
};
add(1, { child: { value: 0 } });
add(1, { child: { value: 1 } });
add(2, { a: { n: 1 }, b: { n: 2 } });
add(3, { rows: [[1], [2]], floats: [[1.25], [2.5]], planes: [[[1]], [[2]]] });
add(4, { state: 1 });
add(5, { tag: 2, box: { value: 9 } });
add(5, { box: { value: 9 }, tag: 2 });
for (const sign of ["", "-"])
  for (const text of [
    "1" + "0".repeat(10001) + "e-10001",
    "0." + "0".repeat(10000) + "1e10001",
    "1e999999999999999999999",
    "1e-999999999999999999999",
    "1" + "0".repeat(10001) + "e999999999999999999999",
    "0." + "0".repeat(10000) + "1e-999999999999999999999",
  ])
    cases.push([6, sign + text]);
for (const text of [
  "-000001-01-01T00:00:00.000Z",
  "-000001-12-31T23:59:59.999Z",
  "-000004-02-29T12:34:56.789Z",
  "0000-01-01T00:00:00.000Z",
  "+010000-01-01T00:00:00.000Z",
]) {
  const value = new Date(text).toISOString();
  add(7, value);
  add(8, [value]);
  add(9, { date: value });
}
const wide = { labels: ["x", 'quote"\n', ""] };
for (let i = 0; i < 32; i++) wide["field" + i] = i;
add(10, wide);
add(10, { ...wide, labels: [] });
let seed = 1234567;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed;
};
for (let i = 0; i < 128; i++) {
  const value = {
    id: random() % 100000,
    text: ["line\nname", 'quote"', "slash\\", "é", "😀"][random() % 5],
    items: [random() % 1000, random() % 1000, null, true],
  };
  add(0, value);
}
const rejected = [
  "[1,,2]",
  '{"a":1,}',
  "[1,]",
  '{"a":undefined}',
  '"line\nname"',
  "01",
  "1e",
  "+1",
  "[",
  '"\\uXXXX"',
];
// Match dynamic-container callback contracts against V8's native algorithms.
function mutationOracle(kind) {
  if (kind === 0) {
    const value = {
      a: {
        toJSON() {
          delete value.b;
          return 1;
        },
      },
      b: 2,
      c: 3,
    };
    return JSON.stringify(value);
  }
  const value = [
    {
      toJSON() {
        if (kind === 3) {
          value.length = 1;
          return 7;
        }
        if (kind === 4) value.length = 0;
        else {
          for (let i = 0; i < (kind === 1 ? 1 : 7); i++) value.push(3);
          value[1] = 9;
        }
        return 1;
      },
    },
    2,
    3,
  ];
  if (kind === 3) {
    value[0].toString = () => String(value[0].toJSON());
    return value.join(",");
  }
  return JSON.stringify(value);
}
let checks = 0;
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const strict of [false, true])
      for (const fast of [false, true]) {
        const label = `${mode}/strict=${strict}/fast=${fast}`;
        const output = path.join(directory, "oracle.wasm");
        execFileSync(
          process.execPath,
          [
            path.join(root, "node_modules/assemblyscript/bin/asc.js"),
            "assembly/__tests__/v8-oracle.fixture.ts",
            "--transform",
            "./transform",
            "--exportRuntime",
            "-O3",
            "-o",
            output,
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
        const module = new WebAssembly.Module(fs.readFileSync(output));
        const guest = () =>
          new WebAssembly.Instance(module, {
            env: {
              abort() {
                throw new Error("JSON rejected input");
              },
            },
          }).exports;
        const input = (g, text) => {
          const data = Buffer.from(text, "utf16le");
          const ptr = g.__pin(g.allocInput(data.length));
          new Uint8Array(g.memory.buffer, ptr, data.length).set(data);
          return ptr;
        };
        const read = (g, ptr) =>
          Buffer.from(
            g.memory.buffer,
            ptr,
            new DataView(g.memory.buffer).getUint32(ptr - 4, true),
          ).toString("utf16le");
        const g = guest();
        for (const [kind, source] of cases) {
          const ptr = input(g, source);
          const actual = read(g, g.run(kind, ptr));
          const parsed = JSON.parse(source);
          const expected =
            kind === 6 ? JSON.parse(JSON.stringify(parsed)) : parsed;
          assert.deepEqual(
            JSON.parse(actual),
            expected,
            `${label} kind=${kind} input=${source.slice(0, 100)}`,
          );
          g.__unpin(ptr);
          checks++;
        }
        for (const [kind, value] of [
          [0, { "": 7 }],
          [1, { a: { n: 1 }, b: { x: { n: 2 }, y: { n: 3 } } }],
          [1, { a: { n: 1 }, b: { y: { n: 3 }, x: { n: 2 } } }],
          [1, { b: { y: { n: 3 }, x: { n: 2 } }, a: { n: 1 } }],
          [2, { a: [1], b: [2] }],
          [3, {}],
          [3, { value: null }],
          [3, { value: "ok" }],
          [4, { value: "ok" }],
          [5, [[7, 8]]],
          [6, { items: [1, 2] }],
        ]) {
          for (const spacing of [undefined, 2]) {
            const source = JSON.stringify(value, null, spacing);
            const ptr = input(g, source);
            const actual = JSON.parse(read(g, g.composed(kind, ptr)));
            const expected =
              kind === 3
                ? { value: null, ...JSON.parse(source) }
                : JSON.parse(source);
            assert.deepEqual(
              actual,
              expected,
              label + " composed " + kind + " " + source,
            );
            g.__unpin(ptr);
            checks++;
          }
        }
        for (let kind = 0; kind < 5; kind++) {
          assert.equal(
            read(g, g.mutation(kind)),
            mutationOracle(kind),
            label + " callback mutation " + kind,
          );
          checks++;
        }
        if (fast) {
          const source = JSON.stringify(wide);
          const ptr = input(g, source);
          assert.equal(
            g.fastWide(ptr),
            1,
            label + " 33-field array fast-path success",
          );
          g.__unpin(ptr);
          checks++;
        }
        if (strict)
          for (const source of rejected) {
            assert.throws(() => JSON.parse(source), SyntaxError);
            const h = guest();
            assert.throws(
              () => h.run(0, input(h, source)),
              /JSON rejected input/,
              label + " RFC rejection " + source,
            );
            checks++;
          }
      }
  console.log(
    `V8 JSON differential oracle: ${checks} checks across 12 configurations`,
  );
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
