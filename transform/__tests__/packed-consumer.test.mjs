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
import * as Runtime from "${entry}";
let calls:i32=0;
@json class Codec { value:i32=-9; @deserializer("number") decode(_source:string):Codec { calls++; const out=new Codec();out.value=99;return out; } }
@json class Generic<T> { value!:T; }
@json class Owner { value:Set<i32>|null=null; }
class Values extends Array<Json.Value> { constructor() { super(); } }
namespace WidthAlias {
 type u64=u8;
 @json({nolazy}) class Record { value:i32=7; }
 export function encode():string { return Json.stringify(new Record()); }
}
export function widthAlias():string { return WidthAlias.encode(); }
const BYTE_QUOTE:i32=1, BYTE_BACKSLASH:i32=2, BYTE_SPACE:i32=3;
@json({nolazy}) class UnicodeRow { a!:string;b!:string;c!:string; }
@json({nolazy}) class UnicodeRows { rows:UnicodeRow[]=[]; }
export function unicodeRows():string {
 assert(BYTE_QUOTE==1&&BYTE_BACKSLASH==2&&BYTE_SPACE==3);
 const row=new UnicodeRow();row.a=String.fromCharCode(65535).repeat(32);
 row.b=(String.fromCharCode(35486)+String.fromCharCode(10)+String.fromCharCode(34)).repeat(8);
 row.c=String.fromCharCode(55296)+"tail語".repeat(8);
 const owner=new UnicodeRows();owner.rows=[row];return Runtime.JSON.stringify(owner);
}
const __json_large_literal_0:i32=2, DATA:i32=3;
@json({nolazy}) class WideLiterals {
${Array.from({ length: 16 }, (_, i) => "long_literal_field_" + i + ':string="value' + i + '";').join("\n")}
}
export function wideLiterals():string {
 assert(__json_large_literal_0+DATA==5);
 const value=new WideLiterals();value.long_literal_field_0="updated語😀"+String.fromCharCode(0);
 return Runtime.JSON.stringify(value);
}
@json({lazy:"strategic"}) class Forwarded { needed:i32=0; text:string=""; }
function forwardedMask(value:Forwarded):i32 { return i32(load<u64>(changetype<usize>(value),offsetof<Forwarded>("__needed_lz"))>>>32==0xffffffff); }
export function forwarded():string {
 const value=Json.parse<Forwarded>('{"needed":7,"text":"\\\\u0061"}');const before=forwardedMask(value);const n=value.needed;assert(n==7);
 const first=Json.stringify(value);const second=Runtime.JSON.stringify(value);assert(changetype<usize>(first)!=changetype<usize>(second));
 return before.toString()+"|"+first+"|"+second;
}
@json({nolazy}) class NumericRow { n:i64=9007199254740993; values:i32[]=[1,2]; }
@json({nolazy}) class NumericRows { rows:NumericRow[]=[]; }
export function numericRows():string {
 assert(isDefined(changetype<NumericRow>(0).__SERIALIZE_FLAT_NUMERIC_FIELDS)==(ASC_RUNTIME==2));
 const owner=new NumericRows();owner.rows=[new NumericRow()];
 return Runtime.JSON.stringify(owner);
}
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
                JSON_STRATEGIC_LAZINESS: "",
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
          assert.equal(
            read(g.forwarded()),
            '1|{"needed":7,"text":"\\u0061"}|{"needed":7,"text":"\\u0061"}',
          );
          assert.equal(
            read(g.numericRows()),
            '{"rows":[{"n":9007199254740993,"values":[1,2]}]}',
          );
          assert.equal(read(g.widthAlias()), '{"value":7}');
          assert.equal(
            read(g.unicodeRows()),
            JSON.stringify({
              rows: [
                {
                  a: "\uffff".repeat(32),
                  b: '語\n"'.repeat(8),
                  c: "\ud800" + "tail語".repeat(8),
                },
              ],
            }),
          );
          assert.equal(
            read(g.wideLiterals()),
            JSON.stringify(
              Object.fromEntries(
                Array.from({ length: 16 }, (_, i) => [
                  "long_literal_field_" + i,
                  i === 0 ? "updated語😀\u0000" : "value" + i,
                ]),
              ),
            ),
          );
          checks += 13;
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
