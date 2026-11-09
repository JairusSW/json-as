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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-packed-"));
const npm = process.env.npm_execpath || "npm";
const npmRun = (args, cwd) =>
  execFileSync(
    npm.endsWith(".js") ? process.execPath : npm,
    npm.endsWith(".js") ? [npm, ...args] : args,
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
let checks = 0;
try {
  const packed = JSON.parse(
    npmRun(
      ["pack", "--ignore-scripts", "--json", "--pack-destination", dir],
      root,
    ),
  )[0];
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "json-as": "file:" + path.join(dir, packed.filename),
        assemblyscript: "0.28.20",
      },
    }),
  );
  npmRun(
    [
      "install",
      "--prefer-offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    dir,
  );
  for (const entry of ["json-as", "json-as/assembly"]) {
    fs.writeFileSync(
      path.join(dir, "consumer.ts"),
      `import {JSON as Json, JSONMode, toRaw, fromRaw, toBox} from "${entry}";
let calls:i32=0;
@json class Codec { value:i32=-9; @deserializer("number") decode(_source:string):Codec { calls++; const out=new Codec();out.value=99;return out; } }
@json class Generic<T> { value!:T; }
@json class Owner { value:Set<i32>|null=null; }
class Values extends Array<Json.Value> { constructor() { super(); } }
export function run():string {
 assert(fromRaw(toRaw('{"x":1}'))=='{"x":1}'&&toBox<i32>(7).value==7&&JSONMode.SWAR==0&&JSONMode.SIMD==1&&JSONMode.NAIVE==2);
 calls=0;const generic=Json.parse<Generic<Codec>>('{"value":7}');assert(generic.value.value==99&&calls==1);
 const owner=new Owner();owner.value=new Set<i32>();assert(Json.parse<Owner>('{"value":null}',owner).value==null);
 const buffers=Json.parse<ArrayBuffer[]>('[[1,2],[3]]',new Array<ArrayBuffer>());assert(buffers.length==2&&load<u8>(changetype<usize>(buffers[0])+1)==2);
 const source=Json.parse<Json.Value>('{"n":1}');const copy=Json.Value.empty();copy.set(source);source.get<Json.Obj>().set<f64>("n",2);assert(Json.stringify(copy)=='{"n":2}');
 const original=new Values();original.push(Json.Value.from<i32>(2));
 const restored=Json.Value.from(original).get<Values>();assert(load<u32>(changetype<usize>(restored)-8)==idof<Values>());
 const nested=Json.parse<Values[]>("[[2]]");assert(load<u32>(changetype<usize>(nested[0])-8)==idof<Values>());
 return Json.stringify(generic.value.value);
}`,
    );
    for (const mode of ["NAIVE", "SWAR", "SIMD"])
      for (const runtime of ["incremental", "minimal", "stub"])
        for (const strict of [false, true]) {
          const wasm = path.join(dir, "consumer.wasm");
          execFileSync(
            process.execPath,
            [
              path.join(dir, "node_modules/assemblyscript/bin/asc.js"),
              "consumer.ts",
              "--transform",
              "json-as",
              "--runtime",
              runtime,
              "--exportRuntime",
              "-O3",
              "-o",
              wasm,
              ...(mode === "SIMD" ? ["--enable", "simd"] : []),
            ],
            {
              cwd: dir,
              env: {
                ...process.env,
                JSON_MODE: mode,
                JSON_STRICT: String(strict),
                JSON_USE_FAST_PATH: "1",
                JSON_AS_LIBRARY_SOURCE: "",
              },
              stdio: "pipe",
            },
          );
          let g;
          const read = (p) =>
            Buffer.from(
              g.memory.buffer,
              p,
              new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
            ).toString("utf16le");
          g = new WebAssembly.Instance(
            new WebAssembly.Module(fs.readFileSync(wasm)),
            {
              env: {
                abort(m, f, l, c) {
                  throw Error(
                    `${entry}/${mode}/${runtime}/${strict}: ${read(m)} (${read(f)}:${l}:${c})`,
                  );
                },
              },
            },
          ).exports;
          assert.equal(read(g.run()), JSON.stringify(99));
          checks += 8;
          console.log(
            `Packed consumer: ${entry}/${mode}/${runtime}/strict=${strict}`,
          );
        }
  }
  console.log(
    `Packed consumer: ${checks} operation checks across 36 configurations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
