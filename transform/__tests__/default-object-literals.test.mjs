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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-default-literals-"));
const quote = (value) =>
  JSON.stringify(value)
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
const cases = ["\u2028", "\u2029"].flatMap((separator) => [
  { key: "long_alias_" + "x".repeat(260) + separator, value: "default" },
  { key: "value", value: "long_default_" + "x".repeat(260) + separator },
]);
const runtimeImport = path
  .relative(dir, path.join(root, "assembly/index"))
  .split(path.sep)
  .join("/");
fs.writeFileSync(
  path.join(dir, "entry.ts"),
  `import {JSON} from ${quote(runtimeImport)};
export function allocInput(n:i32):usize{return __new(n,idof<string>());}
` +
    cases
      .map(
        (entry, index) => `
@json({nolazy}) class Model${index} {
  @alias(${quote(entry.key)}) value:string=${quote(entry.value)};
}
export function read${index}(text:string,reuse:bool):string {
  if(reuse){const out=new Model${index}();return JSON.parse<Model${index}>(text,out).value;}
  return JSON.parse<Model${index}>(text).value;
}`,
      )
      .join("\n"),
);
let checks = 0;
try {
  for (const mode of ["SIMD", "SWAR", "NAIVE"])
    for (const runtime of ["incremental", "minimal", "stub"])
      for (const strict of [false, true])
        for (const fast of [true, false]) {
          const output = path.join(dir, "entry.wasm");
          const build = spawnSync(
            process.execPath,
            [
              "node_modules/assemblyscript/bin/asc.js",
              path.join(dir, "entry.ts"),
              "--transform",
              "./transform",
              "--runtime",
              runtime,
              "--exportRuntime",
              "-O3",
              "-o",
              output,
              ...(mode === "SIMD" ? ["--enable", "simd"] : []),
            ],
            {
              cwd: root,
              encoding: "utf8",
              env: {
                ...process.env,
                JSON_MODE: mode,
                JSON_STRICT: String(strict),
                JSON_USE_FAST_PATH: fast ? "1" : "0",
                JSON_CACHE: "0",
                JSON_LAZY: "false",
              },
            },
          );
          assert.equal(build.status, 0, build.stdout + build.stderr);
          assert.doesNotMatch(
            build.stdout + build.stderr,
            /(?:WARNING|INFO) AS\d+/,
          );
          let g;
          const read = (pointer) =>
            Buffer.from(
              g.memory.buffer,
              pointer,
              new DataView(g.memory.buffer).getUint32(pointer - 4, true) &
                0x7fffffff,
            ).toString("utf16le");
          g = new WebAssembly.Instance(
            new WebAssembly.Module(fs.readFileSync(output)),
            {
              env: {
                abort(message) {
                  throw Error(message ? read(message) : "abort");
                },
              },
            },
          ).exports;
          for (const [index, entry] of cases.entries())
            for (const expected of ["changed", entry.value, "changed again"])
              for (const reuse of [false, true]) {
                const bytes = Buffer.from(
                  JSON.stringify({ [entry.key]: expected }),
                  "utf16le",
                );
                const input = g.__pin(g.allocInput(bytes.length));
                new Uint8Array(g.memory.buffer, input, bytes.length).set(bytes);
                const result = g.__pin(g["read" + index](input, Number(reuse)));
                g.__unpin(input);
                g.__collect();
                assert.equal(
                  read(result),
                  expected,
                  `${mode}/${runtime}/strict=${strict}/fast=${fast}/case=${index}/reuse=${reuse}`,
                );
                g.__unpin(result);
                checks++;
              }
        }
  console.log(
    `Default object literals: ${checks} changed/exact-default/fresh/reused/GC checks across 36 configurations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
