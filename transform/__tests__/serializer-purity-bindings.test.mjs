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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-purity-bindings-"));
const runtime = JSON.stringify(
  path.relative(dir, path.join(root, "assembly/index")),
);
const base = JSON.stringify(path.join(root, "transform/lib/index.js"));
const visitor = JSON.stringify(path.join(root, "transform/lib/visitor.js"));
fs.writeFileSync(
  path.join(dir, "load.ts"),
  `export function read<T>(ptr:usize,offset:usize=0):T{touchOwner();return load<T>(ptr+offset);}`,
);
fs.writeFileSync(
  path.join(dir, "model.ts"),
  `import{read as load}from"./load";@json({nolazy})export class Row{value:f64=7;}`,
);
fs.writeFileSync(
  path.join(dir, "formatter.mjs"),
  `
import Base from ${base};import{Visitor}from ${visitor};
export default class extends Base{afterParse(parser){
 const imports=[];
 for(const s of parser.sources)for(const n of s.statements)if(n.path?.value==='xjb-as')imports.push(n);
 const dtoa=parser.sources.find(s=>s.internalPath.endsWith('/assembly/dtoa'));
 const ftoa=parser.sources.find(s=>s.internalPath.endsWith('/assembly/ftoa'));
 parser.parseFile('import{dtoa_buffered as actualDtoa}from"xjb-as/assembly/dtoa";import{ftoa_buffered as actualFtoa}from"xjb-as/assembly/ftoa";export function dtoa_buffered(p:usize,n:f64):u32{touchOwner();return actualDtoa(p,n);}export function ftoa_buffered(p:usize,n:f32):u32{touchOwner();return actualFtoa(p,n);}', '__review_float_wrapper.ts',false);
 const wrapper=parser.sources.find(s=>s.internalPath==='__review_float_wrapper');
 wrapper.statements[0].internalPath=dtoa.internalPath;wrapper.statements[1].internalPath=ftoa.internalPath;
 for(const n of imports)n.internalPath=wrapper.internalPath;
 super.afterParse(parser);
}}
`,
);
const cases = {
  load: `import{Row}from"./model";
@lazy let owner=new Map<string,Row>();let calls:i32=0;let mutated:bool=false;
@global function touchOwner():void{calls++;if(!mutated){mutated=true;owner.set("added",new Row());}}
export function run():string{owner.clear();owner.set("a",new Row());calls=0;mutated=false;const out=JSON.stringify(owner);return out+"|"+calls.toString();}`,
  dtoa: `@json({nolazy})class Row{amount:f64=1.5;}
@lazy let owner=new Map<string,Row>();let mutated:bool=false;
@global function touchOwner():void{if(!mutated){mutated=true;owner.clear();for(let i=0;i<8;i++)owner.set("new"+i.toString(),new Row());}}
export function run():string{owner.clear();owner.set("a",new Row());owner.set("b",new Row());mutated=false;return JSON.stringify(owner);}`,
  ftoa: `@json({nolazy})class Row{amount:f32=1.5;}
@lazy let owner=new Map<string,Row>();let mutated:bool=false;
@global function touchOwner():void{if(!mutated){mutated=true;owner.clear();for(let i=0;i<8;i++)owner.set("new"+i.toString(),new Row());}}
export function run():string{owner.clear();owner.set("a",new Row());owner.set("b",new Row());mutated=false;return JSON.stringify(owner);}`,
  vector: `namespace App{
let calls:i32=0;
function i16x8(a:i32,b:i32,c:i32,d:i32,e:i32,f:i32,g:i32,h:i32):v128{calls++;return i32x4.splat(0);}
@json({nolazy})class Row<v128>{long_field_name:string="abc";}
export function render():string{calls=0;const out=JSON.stringify(new Row<i32>());return out+"|"+calls.toString();}
}export function run():string{return App.render();}`,
  depth: `type i32=i64;@json({nolazy})class Row{value:f64=7;}
export function run():string{const map=new Map<string,Row>();map.set("a",new Row());return JSON.stringify(map);}`,
  generic: `@json({nolazy})class Row<i32>{value:f64=7;}
export function run():string{const map=new Map<string,Row<string>>();map.set("a",new Row<string>());return JSON.stringify(map);}`,
};
fs.writeFileSync(
  path.join(dir, "int-model.ts"),
  `import{read as load}from"./load";@json({nolazy})export class RowInt{value:i32=7;}`,
);
cases.loadInteger = cases.load.replace(
  'Row}from"./model"',
  'RowInt as Row}from"./int-model"',
);
const expected = {
  load: '{"a":{"value":7}}|1',
  loadInteger: '{"a":{"value":7}}|1',
  dtoa: '{"a":{"amount":1.5}}',
  ftoa: '{"a":{"amount":1.5}}',
  vector: '{"long_field_name":"abc"}|0',
  depth: '{"a":{"value":7}}',
  generic: '{"a":{"value":7}}',
};
let checks = 0;
try {
  for (const [name, source] of Object.entries(cases)) {
    if (
      process.env.SERIALIZER_BINDING_CASE &&
      process.env.SERIALIZER_BINDING_CASE !== name
    )
      continue;
    for (const runtimeKind of ["incremental", "minimal", "stub"])
      for (const mode of name === "vector"
        ? ["SIMD"]
        : ["NAIVE", "SWAR", "SIMD"]) {
        if (
          process.env.SERIALIZER_BINDING_QUICK &&
          mode !== (name === "vector" ? "SIMD" : "SWAR")
        )
          continue;
        const entry = path.join(dir, "entry.ts"),
          out = path.join(dir, "out.wasm");
        fs.writeFileSync(
          entry,
          `import{JSON}from ${runtime};
` + source,
        );
        const build = spawnSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            entry,
            "--transform",
            name === "dtoa" || name === "ftoa"
              ? path.join(dir, "formatter.mjs")
              : "./transform",
            "--runtime",
            runtimeKind,
            "-O3",
            "-o",
            out,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ],
          {
            cwd: root,
            encoding: "utf8",
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: "false",
              JSON_CACHE: "0",
            },
          },
        );
        assert.equal(
          build.status,
          0,
          `${name}/${mode}: ${build.stdout}${build.stderr}`,
        );
        assert.doesNotMatch(
          build.stdout + build.stderr,
          /(?:WARNING|INFO) AS\d+/,
        );
        const e = new WebAssembly.Instance(
          new WebAssembly.Module(fs.readFileSync(out)),
          {
            env: {
              abort() {
                throw Error(`${name}/${mode}: abort`);
              },
            },
          },
        ).exports;
        const p = e.run(),
          text = Buffer.from(
            e.memory.buffer,
            p,
            new DataView(e.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
          ).toString("utf16le");
        assert.equal(text, expected[name], `${name}/${mode}`);
        checks++;
      }
  }
  console.log(
    `Serializer purity bindings: ${checks} mutation/literal/type checks passed`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
