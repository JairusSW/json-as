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
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-borrowed-records-"));
const url = (file) => pathToFileURL(path.join(root, file)).href;
const runtime = path
  .relative(dir, path.join(root, "assembly/index"))
  .split(path.sep)
  .join("/");
fs.writeFileSync(
  path.join(dir, "entry.ts"),
  `
import {JSON} from ${JSON.stringify(runtime)};
@json({nolazy}) class Leaf { name:string=''; n:i64=7; }
@json({nolazy}) class Middle { left:Leaf=new Leaf(); right:Leaf|null=new Leaf(); }
@json({nolazy}) class Root { value:Middle=new Middle(); tag:string='root'; }
@json({nolazy}) class SingleRoot { value:Middle=new Middle(); }
@unmanaged @json({nolazy}) class RawOwner { child:Leaf=new Leaf(); }
export function allocInput(n:i32):usize{return __new(n,idof<string>());}
export function run(input:string):string {const root=new Root();root.value.left.name=input+'-left';root.value.right!.name=input+'-right';return JSON.stringify(root);}
export function single(input:string):string {const root=new SingleRoot();root.value.left.name=input+'-left';root.value.right=null;return JSON.stringify(root);}
export function rows(input:string):string {const out:SingleRoot[]=[];for(let i=0;i<4;i++){const root=new SingleRoot();root.value.left.name=input+'-'+i.toString();root.value.right=null;out.push(root);}return JSON.stringify(out);}
export function makeRaw(input:string):RawOwner {const out=new RawOwner();out.child.name=input+'-child';return out;}
export function raw(out:RawOwner):string {return JSON.stringify(out);}
export function calls():i32{return __borrowRecordCallsRead();}
`,
);
fs.writeFileSync(
  path.join(dir, "transform.mjs"),
  `
import Base from ${JSON.stringify(url("transform/lib/index.js"))};
import {Visitor} from ${JSON.stringify(url("transform/lib/visitor.js"))};
import {SimpleParser,toString} from ${JSON.stringify(url("transform/lib/util.js"))};
class Bind extends Visitor {_visit(node,parent){node.range=this.range;super._visit(node,parent);}}
const bind=(node,range)=>{const visitor=new Bind();visitor.range=range;visitor.visit(node);};
export default class extends Base {
 afterParse(parser){
  super.afterParse(parser);
  const runtime=parser.sources.find(s=>s.internalPath.endsWith('/assembly/index'));
  if(!runtime)throw Error('Missing runtime');
  const helpers=runtime.statements.filter(n=>n.name?.text?.startsWith('__json_borrow_record_'));
  const active=process.env.PROBE_RUNTIME==='incremental';
  if(helpers.length!==(active?1:0))throw Error('Unexpected borrowed entry count: '+helpers.length);
  for(const helper of helpers){
   const body=SimpleParser.parseTopLevelStatement('function probe():void{__borrowRecordCalls++;__collect();}').body;
   bind(body,helper.range);helper.body.statements.unshift(...body.statements);
  }
  class Stress extends Visitor {
   visitClassDeclaration(node,isDefault,parent){
    const method=node.members.find(m=>m.name?.text==='__SERIALIZE');
    if(node.name.text==='RawOwner'&&toString(method.body).includes('__json_borrow_record_'))throw Error('Unmanaged owners must retain managed roots');
    if(active&&node.name.text==='Leaf'){
     const body=SimpleParser.parseTopLevelStatement('function stress():void{__collect();__collect();__collect();for(let i=0;i<128;i++){const scratch=__new(16,idof<ArrayBuffer>());memory.fill(scratch,0,16);}}').body;
     bind(body,method.range);method.body.statements.unshift(...body.statements);
    }
    super.visitClassDeclaration(node,isDefault,parent);
   }
  }
  for(const source of parser.sources)new Stress().visit(source.statements);
  const declarations=[SimpleParser.parseTopLevelStatement('let __borrowRecordCalls:i32=0;'),SimpleParser.parseTopLevelStatement('@global function __borrowRecordCallsRead():i32{return __borrowRecordCalls;}')];
  bind(declarations,runtime.range);runtime.statements.push(...declarations);
 }
}
`,
);
let checks = 0,
  collections = 0;
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of ["incremental", "minimal", "stub"])
      for (const opt of ["-O0", "-O3"]) {
        const output = path.join(dir, "entry.wasm");
        const log = execFileSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            path.join(dir, "entry.ts"),
            "--transform",
            path.join(dir, "transform.mjs"),
            "--runtime",
            runtime,
            "--exportRuntime",
            opt,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
            "-o",
            output,
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: "false",
              JSON_CACHE: "0",
              PROBE_RUNTIME: runtime,
            },
            stdio: "pipe",
          },
        );
        assert.doesNotMatch(log.toString(), /(?:WARNING|INFO) AS\d+/);
        let g;
        const read = (ptr) =>
          Buffer.from(
            g.memory.buffer,
            ptr,
            new DataView(g.memory.buffer).getUint32(ptr - 4, true),
          ).toString("utf16le");
        g = new WebAssembly.Instance(
          new WebAssembly.Module(fs.readFileSync(output)),
          {
            env: {
              abort() {
                throw Error("Unexpected Wasm abort");
              },
            },
          },
        ).exports;
        const held = [];
        for (let i = 0; i < 64; i++) {
          const input =
              "汉語 " +
              i +
              ' "\\\n' +
              String.fromCharCode(0xd800 + (i % 16)) +
              "x".repeat(i * 3),
            bytes = Buffer.from(input, "utf16le"),
            ptr = g.__pin(g.allocInput(bytes.length));
          new Uint8Array(g.memory.buffer, ptr, bytes.length).set(bytes);
          for (const method of ["run", "single", "rows"]) {
            const out = g.__pin(g[method](ptr));
            if (runtime !== "stub") g.__collect();
            const value =
              method === "run"
                ? {
                    value: {
                      left: { name: input + "-left", n: 7 },
                      right: { name: input + "-right", n: 7 },
                    },
                    tag: "root",
                  }
                : method === "single"
                  ? {
                      value: {
                        left: { name: input + "-left", n: 7 },
                        right: null,
                      },
                    }
                  : Array.from({ length: 4 }, (_, j) => ({
                      value: {
                        left: { name: input + "-" + j, n: 7 },
                        right: null,
                      },
                    }));
            const expected = JSON.stringify(value);
            assert.equal(
              read(out),
              expected,
              mode + "/" + runtime + "/" + opt + "/" + method,
            );
            held.push([out, expected]);
            checks++;
          }
          const raw = g.makeRaw(ptr),
            rawOut = g.__pin(g.raw(raw));
          assert.equal(
            read(rawOut),
            JSON.stringify({ child: { name: input + "-child", n: 7 } }),
          );
          g.__unpin(rawOut);
          checks++;
          g.__unpin(ptr);
        }
        if (runtime !== "stub") g.__collect();
        for (const [ptr, expected] of held) {
          assert.equal(read(ptr), expected);
          g.__unpin(ptr);
          checks++;
        }
        assert.equal(g.calls(), runtime === "incremental" ? 64 * 12 : 0);
        collections += g.calls();
        console.log(
          mode,
          runtime,
          opt,
          "borrowed and unmanaged-owner GC controls pass",
        );
      }
  console.log(
    "Borrowed records:",
    checks,
    "output checks;",
    collections,
    "collections at borrowed entries; eighteen configurations",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
