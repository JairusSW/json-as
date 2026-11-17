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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-writer-bindings-"));
const runtimeImport = JSON.stringify(
  path.relative(dir, path.join(root, "assembly/index")),
);
const inspect = path.join(dir, "inspect.mjs");
fs.writeFileSync(
  inspect,
  `
import assert from "node:assert/strict";
import Base from ${JSON.stringify(path.join(root, "transform/lib/index.js"))};
import {toString} from ${JSON.stringify(path.join(root, "transform/lib/util.js"))};
export default class extends Base {
  afterParse(parser) {
    super.afterParse(parser);
    if (process.env.JSON_WRITER_BINDING_CASE === "allocator") return;
    const text = toString(parser.sources.find(s => s.internalPath.endsWith("/entry")));
    assert.ok(text.includes("__json_numeric_batch_"), "batch optimization must remain enabled");
  }
}
`,
);
let checks = 0;
try {
  for (const variant of ["plain", "generic", "allocator"])
    for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
      if (
        process.env.JSON_BINDINGS_VARIANT &&
        variant !== process.env.JSON_BINDINGS_VARIANT
      )
        continue;
      if (process.env.JSON_BINDINGS_QUICK && mode !== "SWAR") continue;
      const entry = path.join(dir, "entry.ts");
      const output = path.join(dir, "out.wasm");
      fs.writeFileSync(
        entry,
        `import { JSON } from ${runtimeImport};
${
  variant === "allocator"
    ? `
import { __new as nativeNew } from "rt/itcms";
@lazy let calls: i32 = 0;
@global
export function customNew(size: usize, id: u32): usize {
  calls++; return nativeNew(size, id);
}
export function explicit(): i32 { calls = 0; __new(8, idof<string>()); return calls; }
export function run(): string { calls = 0; return JSON.stringify<string>("abc"); }
export function observed(): i32 { return calls; }
`
    : `
let calls: i32 = 0;
${
  variant === "plain"
    ? `
function min(a: i32, b: i32): i32 { calls++; return a < b ? a : b; }
function max(a: usize, b: usize): usize { calls++; return a > b ? a : b; }
`
    : `
function min<T>(a: T, b: T): T { calls++; return a < b ? a : b; }
function max<T>(a: T, b: T): T { calls++; return a > b ? a : b; }
`
}
@json({ nolazy }) class Row { n: i32 = 7; }
@json({ nolazy }) class Rows { rows: Row[] = []; }
export function run(count: i32): string {
  const data = new Rows();
  for (let i = 0; i < count; i++) data.rows.push(new Row());
  calls = 0;
  return JSON.stringify(data);
}
export function observed(): i32 { return calls; }
`
}`,
      );
      const build = spawnSync(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          entry,
          "--transform",
          inspect,
          "--runtime",
          "incremental",
          "-O3",
          "-o",
          output,
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ...(variant === "allocator" ? ["--use", "__new=customNew"] : []),
        ],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            JSON_MODE: mode,
            JSON_WRITER_BINDING_CASE: variant,
            JSON_CACHE: "0",
          },
        },
      );
      assert.equal(
        build.status,
        0,
        `${variant}/${mode}: ${build.stdout}${build.stderr}`,
      );
      assert.doesNotMatch(
        build.stdout + build.stderr,
        /(?:WARNING|INFO) AS\d+/,
      );
      const e = new WebAssembly.Instance(
        new WebAssembly.Module(fs.readFileSync(output)),
        {
          env: {
            abort() {
              throw Error(`${variant}/${mode}: abort`);
            },
          },
        },
      ).exports;
      const read = (p) =>
        Buffer.from(
          e.memory.buffer,
          p,
          new DataView(e.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
        ).toString("utf16le");
      if (variant === "allocator") {
        assert.equal(e.explicit(), 1);
        assert.equal(read(e.run()), '"abc"');
        assert.equal(
          e.observed(),
          1,
          "string output must retain the configured allocator hook",
        );
        checks += 3;
      } else {
        for (const count of [0, 1, 15, 16, 17, 32, 33]) {
          assert.equal(
            read(e.run(count)),
            JSON.stringify({
              rows: Array.from({ length: count }, () => ({ n: 7 })),
            }),
          );
          assert.equal(
            e.observed(),
            0,
            "numeric batching must not call application min/max",
          );
          checks += 2;
        }
      }
    }
  console.log(`Serialization bindings: ${checks} checks passed`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
