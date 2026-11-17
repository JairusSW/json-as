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
import { Parser } from "assemblyscript";
import { JSONTransform } from "../lib/index.js";

const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-literal-stores-"));
const literals = Array.from({ length: 129 }, (_, length) =>
  "abcdefghijklmnopqrstuvwxyz0123456789".repeat(4).slice(0, length),
);
for (let length = 0; length < 32; length++)
  for (const special of [
    "\0",
    "\n",
    '"',
    "\\",
    "\u2028",
    "\u2029",
    "é",
    "\u7fff",
    "\u8000",
    "\uffff",
    "😀",
    "\ud800",
  ])
    literals.push(JSON.stringify("x".repeat(length) + special + "tail"));

let checks = 0;
try {
  for (const simd of [false, true]) {
    const parser = new Parser();
    parser.parseFile("class Literal {}", "literal.ts", true);
    const node = parser.sources[0].statements[0];
    const transform = new JSONTransform();
    transform.schema = { node };
    const cases = literals.map(
      (literal, index) =>
        `case ${index}: { ${transform.getStores(literal, simd, "cursor").join("\n")} break; }`,
    );
    const source = path.join(dir, "stores.ts");
    fs.writeFileSync(
      source,
      `${(transform.simdStatements.get(node.range.source) ?? []).join("\n")}
      const ARENA: usize = memory.data(1024, 16);
      export function start(): usize { return ARENA; }
      export function run(index: i32): usize {
        memory.fill(ARENA, 0xa5, 1024);
        let cursor = ARENA + 16;
        switch (index) { ${cases.join("\n")} }
        return cursor;
      }`,
    );
    for (const runtime of ["incremental", "minimal", "stub"]) {
      const wasm = path.join(dir, "stores.wasm");
      execFileSync(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          source,
          "--runtime",
          runtime,
          "-O3",
          "-o",
          wasm,
          ...(simd ? ["--enable", "simd"] : []),
        ],
        { cwd: root, stdio: "pipe" },
      );
      const g = new WebAssembly.Instance(
        new WebAssembly.Module(fs.readFileSync(wasm)),
      ).exports;
      for (const [index, literal] of literals.entries()) {
        const expected = Buffer.from(literal, "utf16le");
        const next = g.run(index);
        const start = g.start();
        assert.equal(next, start + 16 + expected.length);
        const actual = Buffer.from(g.memory.buffer, start, 1024);
        assert.deepEqual(actual.subarray(0, 16), Buffer.alloc(16, 0xa5));
        assert.deepEqual(actual.subarray(16, 16 + expected.length), expected);
        assert.deepEqual(
          actual.subarray(16 + expected.length),
          Buffer.alloc(1008 - expected.length, 0xa5),
        );
        checks++;
      }
    }
  }
  const expected = JSON.stringify({
    "hello😀": 7,
    "abcd\uffff": "😀content",
    "abcd\u8000": "literal\u8000\uffff",
  });
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of ["incremental", "minimal", "stub"]) {
      const wasm = path.join(dir, "labels.wasm");
      execFileSync(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          "assembly/__tests__/literal-stores.fixture.ts",
          "--transform",
          "./transform",
          "--runtime",
          runtime,
          "--exportRuntime",
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
      for (let kind = 0; kind < 3; kind++) {
        const ptr = g.__pin(g.run(kind));
        g.__collect();
        const bytes =
          new DataView(g.memory.buffer).getUint32(ptr - 4, true) & 0x7fffffff;
        assert.equal(
          Buffer.from(g.memory.buffer, ptr, bytes).toString("utf16le"),
          expected,
        );
        g.__unpin(ptr);
        checks++;
      }
      for (const generic of [false, true]) {
        const ptr = g.__pin(g.scopedWidths(generic));
        g.__collect();
        const bytes =
          new DataView(g.memory.buffer).getUint32(ptr - 4, true) & 0x7fffffff;
        assert.equal(
          Buffer.from(g.memory.buffer, ptr, bytes).toString("utf16le"),
          JSON.stringify({ x: 7, ab: 8, "long\u8000\uffff😀key": 9 }),
        );
        g.__unpin(ptr);
        checks++;
      }
      const imported = g.__pin(g.importedWidth());
      g.__collect();
      const importedBytes =
        new DataView(g.memory.buffer).getUint32(imported - 4, true) &
        0x7fffffff;
      assert.equal(
        Buffer.from(g.memory.buffer, imported, importedBytes).toString(
          "utf16le",
        ),
        '{"value":7}',
      );
      g.__unpin(imported);
      checks++;
    }
  const asc = (await import("assemblyscript/asc")).default;
  const previousMode = process.env.JSON_MODE;
  try {
    process.env.JSON_MODE = "NAIVE";
    const source = path.join(dir, "repeated.ts"),
      output = path.join(dir, "repeated.wasm");
    const runtimeImport = path
      .relative(dir, path.join(root, "assembly/index"))
      .split(path.sep)
      .join("/");
    for (const [index, width] of ["u64", "u16", "u64"].entries()) {
      fs.writeFileSync(
        source,
        `
        import {JSON} from ${JSON.stringify(runtimeImport)};
        type ${width}=u8;
        @json({nolazy})class Record { value:i32=${index + 7}; }
        export function run():string {return JSON.stringify(new Record());}
      `,
      );
      const result = await asc.main(
        [
          source,
          "--transform",
          "./transform",
          "--runtime",
          "incremental",
          "-O3",
          "-o",
          output,
        ],
        {
          stdout: asc.createMemoryStream(),
          stderr: asc.createMemoryStream(),
        },
      );
      assert.ifError(result.error && Error(result.stderr.toString()));
      assert.doesNotMatch(result.stderr.toString(), /(?:WARNING|INFO) AS\d+/);
      const g = new WebAssembly.Instance(
        new WebAssembly.Module(fs.readFileSync(output)),
        {
          env: {
            abort() {
              throw Error("Repeated literal abort");
            },
          },
        },
      ).exports;
      const ptr = g.run(),
        bytes =
          new DataView(g.memory.buffer).getUint32(ptr - 4, true) & 0x7fffffff;
      assert.equal(
        Buffer.from(g.memory.buffer, ptr, bytes).toString("utf16le"),
        JSON.stringify({ value: index + 7 }),
      );
      checks++;
    }
  } finally {
    if (previousMode === undefined) delete process.env.JSON_MODE;
    else process.env.JSON_MODE = previousMode;
  }
  console.log(
    `Literal stores: ${checks} payload/cursor/fence, scoped-width and public Unicode-codec checks across 18 configurations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
