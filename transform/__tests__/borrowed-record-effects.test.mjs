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
import { pathToFileURL } from "node:url";
const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-borrow-effects-"));
const url = (file) => pathToFileURL(path.join(root, file)).href;
const runtime = path
  .relative(dir, path.join(root, "assembly/index"))
  .split(path.sep)
  .join("/");
const fixtures = {
  effects: `
import {JSON} from '../../../assembly/index';
@json({nolazy}) class LeafChild { name:string=''; n:i32=7; }
@json({nolazy}) class BoxChild { boxed:JSON.Box<i32>|null=new JSON.Box<i32>(256);wide:JSON.Box<u64>|null=new JSON.Box<u64>(9007199254740993);name:string=''; }
@json({nolazy}) class BoxOwner { child:BoxChild=new BoxChild(); }
let before:PrefixParent|null=null,after:SuffixParent|null=null,pending:string='',phase:bool=false,effects:i32=0,detach:bool=false;
let detachedRows:PrefixParent[]=[];
@json class Mutator {
 @serializer('number') encode(self:Mutator):string {
  const child=new LeafChild();child.name=pending+'-new';
  if(phase)after!.child=child;else {before!.child=child;if(detach){before=null;unchecked(detachedRows[0]=changetype<PrefixParent>(0));detachedRows.length=0;}}
  effects++;__collect();return '7';
 }
}
@json({nolazy}) class PrefixParent { effect:JSON.Value=JSON.Value.from<bool>(false);child:LeafChild=new LeafChild(); }
@json({nolazy}) class SuffixParent { child:LeafChild=new LeafChild();effect:JSON.Value=JSON.Value.from<bool>(false); }
export function boxed(input:string):string {const owner=new BoxOwner();owner.child.name=input;return JSON.stringify(owner);}
export function prefix(input:string):string {const owner=new PrefixParent();pending=input;phase=false;detach=false;before=owner;owner.child.name=input+'-old';owner.effect=JSON.Value.from<Mutator>(new Mutator());return JSON.stringify(owner);}
export function suffix(input:string):string {const owner=new SuffixParent();pending=input;phase=true;detach=false;after=owner;owner.child.name=input+'-old';owner.effect=JSON.Value.from<Mutator>(new Mutator());return JSON.stringify(owner);}
export function allocInput(n:i32):usize{return __new(n,idof<string>());}
export function calls():i32{return __borrowEffectCallsRead();}
export function effectCalls():i32{return effects;}

export function prepareDetached(input:string):void {const owner=new PrefixParent();pending=input;phase=false;detach=true;before=owner;owner.child.name=input+'-old';owner.effect=JSON.Value.from<Mutator>(new Mutator());detachedRows=[owner];}
export function detached():string {return JSON.stringify(detachedRows);}

`,
  native: `
import {JSON as J} from '../../../assembly/index';class JSON{}type NativeBox=J.Box<i32>;
@json({nolazy}) class LeafChild{field:NativeBox=new J.Box<i32>(7);name:string='';}
@json({nolazy}) class RootOwner{child:LeafChild=new LeafChild();}
export function run(input:string):string{const owner=new RootOwner();owner.child.name=input;return J.stringify(owner);}
export function allocInput(n:i32):usize{return __new(n,idof<string>());}
export function calls():i32{return __borrowEffectCallsRead();}
`,
  shadow: `
import {JSON as J} from '../../../assembly/index';class JSON{}@json({nolazy}) class Box<T>{value:T;constructor(value:T){this.value=value;}}
@json({nolazy}) class LeafChild{field:Box<i32>=new Box<i32>(7);name:string='';}
@json({nolazy}) class RootOwner{child:LeafChild=new LeafChild();}
export function run(input:string):string{const owner=new RootOwner();owner.child.name=input;return J.stringify(owner);}
export function allocInput(n:i32):usize{return __new(n,idof<string>());}
export function calls():i32{return __borrowEffectCallsRead();}
`,
  derived: `
import {JSON as J} from '../../../assembly/index';class JSON{}class DerivedBox extends J.Box<i32>{constructor(){super(7);}}
@json({nolazy}) class LeafChild{field:J.Box<i32>=new DerivedBox();name:string='';}
@json({nolazy}) class RootOwner{child:LeafChild=new LeafChild();}
export function run(input:string):string{const owner=new RootOwner();owner.child.name=input;return J.stringify(owner);}
export function allocInput(n:i32):usize{return __new(n,idof<string>());}
export function calls():i32{return __borrowEffectCallsRead();}
`,
};
for (const [name, source] of Object.entries(fixtures))
  fs.writeFileSync(
    path.join(dir, name + ".ts"),
    source.replace("'../../../assembly/index'", JSON.stringify(runtime)) +
      "\nexport function cursorCalls():i32{return __borrowCursorCallsRead();}",
  );
fs.writeFileSync(
  path.join(dir, "transform.mjs"),
  `
import Base from ${JSON.stringify(url("transform/lib/index.js"))};
import {ArrayRowSerializers} from ${JSON.stringify(url("transform/lib/array-row.js"))};
import {RecordCursorWriters} from ${JSON.stringify(url("transform/lib/record-cursors.js"))};
import {Visitor} from ${JSON.stringify(url("transform/lib/visitor.js"))};
import {SimpleParser} from ${JSON.stringify(url("transform/lib/util.js"))};
import {diagnosticsRuntimeRoot} from ${JSON.stringify(url("transform/lib/diagnostics.js"))};
class Bind extends Visitor{_visit(node,parent){node.range=this.range;super._visit(node,parent);}}
const bind=(node,range)=>{const visitor=new Bind();visitor.range=range;visitor.visit(node);};
export default class extends Base{
 afterParse(parser){
  const original=ArrayRowSerializers.prototype.borrowRecord;
  const originalCursor=RecordCursorWriters.prototype.rewrite;
  if(process.env.PROBE_CURSOR_DISABLED==='true')RecordCursorWriters.prototype.rewrite=()=>null;
  if(process.env.PROBE_DISABLED==='true')ArrayRowSerializers.prototype.borrowRecord=()=>{};
  try{super.afterParse(parser);}finally{ArrayRowSerializers.prototype.borrowRecord=original;RecordCursorWriters.prototype.rewrite=originalCursor;}
  const runtime=parser.sources.find(s=>s.internalPath===diagnosticsRuntimeRoot(parser.sources)+'assembly/index');
  const helpers=parser.sources.flatMap(s=>s.statements).filter(n=>/^__json_(?:borrow_record|cursor_record)_\\d+$/.test(n.name?.text));
  for(const helper of helpers){const body=SimpleParser.parseTopLevelStatement('function probe():void{__borrowEffectCallsHit();'+(helper.name.text.startsWith('__json_cursor_record_')?'__borrowCursorCallsHit();':'')+'__collect();__collect();}').body;bind(body,helper.range);helper.body.statements.unshift(...body.statements);}
  class Stress extends Visitor{visitClassDeclaration(node,isDefault,parent){
   if(['LeafChild','BoxChild'].includes(node.name.text)){
    const method=node.members.find(m=>m.name?.text==='__SERIALIZE');
    const body=SimpleParser.parseTopLevelStatement('function stress():void{__collect();__collect();__collect();for(let i=0;i<128;i++){const scratch=__new(16,idof<ArrayBuffer>());memory.fill(scratch,0,16);}}').body;
    bind(body,method.range);method.body.statements.unshift(...body.statements);
   }super.visitClassDeclaration(node,isDefault,parent);
  }}for(const source of parser.sources)new Stress().visit(source.statements);
  const nodes=[SimpleParser.parseTopLevelStatement('let __borrowCursorCalls:i32=0;'),SimpleParser.parseTopLevelStatement('@global function __borrowCursorCallsRead():i32{return __borrowCursorCalls;}'),SimpleParser.parseTopLevelStatement('@global function __borrowCursorCallsHit():void{__borrowCursorCalls++;}'),SimpleParser.parseTopLevelStatement('let __borrowEffectCalls:i32=0;'),SimpleParser.parseTopLevelStatement('@global function __borrowEffectCallsRead():i32{return __borrowEffectCalls;}'),SimpleParser.parseTopLevelStatement('@global function __borrowEffectCallsHit():void{__borrowEffectCalls++;}')];
  bind(nodes,runtime.range);runtime.statements.push(...nodes);
 }
}
`,
);
const compile = (name, mode, opt, disabled = false, cursorDisabled = false) => {
  const output = path.join(dir, "entry.wasm");
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/assemblyscript/bin/asc.js",
      path.join(dir, name + ".ts"),
      "--transform",
      path.join(dir, "transform.mjs"),
      opt,
      "--runtime",
      "incremental",
      "--exportRuntime",
      ...(mode === "SIMD" ? ["--enable", "simd"] : []),
      "-o",
      output,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        JSON_MODE: mode,
        JSON_STRICT: "false",
        JSON_USE_FAST_PATH: "1",
        JSON_CACHE: "0",
        PROBE_DISABLED: String(disabled),
        PROBE_CURSOR_DISABLED: String(cursorDisabled),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /(?:WARNING|INFO) AS\d+/);
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
  const input = (s) => {
    const bytes = Buffer.from(s, "utf16le"),
      ptr = g.__pin(g.allocInput(bytes.length));
    new Uint8Array(g.memory.buffer, ptr, bytes.length).set(bytes);
    return ptr;
  };
  return { g, read, input };
};
let effects = 0,
  identities = 0;
try {
  const configurations = [];
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const opt of ["-O0", "-O3"])
      configurations.push({ mode, opt, disabled: false });
  configurations.push({ mode: "SIMD", opt: "-O3", disabled: true });
  configurations.push({
    mode: "SWAR",
    opt: "-O3",
    disabled: false,
    cursorDisabled: true,
  });
  configurations.push({
    mode: "SIMD",
    opt: "-O3",
    disabled: false,
    cursorDisabled: true,
  });
  for (const {
    mode,
    opt,
    disabled,
    cursorDisabled = false,
  } of configurations) {
    const { g, read, input } = compile(
        "effects",
        mode,
        opt,
        disabled,
        cursorDisabled,
      ),
      held = [];
    for (let i = 0; i < 32; i++) {
      const text =
          "汉語 " +
          i +
          ' "\\\n' +
          String.fromCharCode(0xd800 + (i % 16)) +
          (i === 31 ? "x".repeat(32768) : ""),
        ptr = input(text);
      const expected = {
        boxed:
          '{"child":{"boxed":256,"wide":9007199254740993,"name":' +
          JSON.stringify(text) +
          "}}",
        prefix: JSON.stringify({
          effect: 7,
          child: { name: text + "-new", n: 7 },
        }),
        suffix: JSON.stringify({
          child: { name: text + "-old", n: 7 },
          effect: 7,
        }),
        detached: JSON.stringify([
          { effect: 7, child: { name: text + "-new", n: 7 } },
        ]),
      };
      for (const name of ["boxed", "prefix", "suffix", "detached"]) {
        if (name === "detached") g.prepareDetached(ptr);
        const out = g.__pin(name === "detached" ? g.detached() : g[name](ptr));
        g.__collect();
        assert.equal(read(out), expected[name], mode + "/" + opt + "/" + name);
        held.push([out, expected[name]]);
        effects++;
      }
      g.__unpin(ptr);
    }
    g.__collect();
    for (const [ptr, expected] of held) {
      assert.equal(read(ptr), expected);
      g.__unpin(ptr);
      effects++;
    }
    assert.equal(g.calls(), disabled ? 0 : 128);
    assert.equal(g.cursorCalls(), disabled || cursorDisabled ? 0 : 128);
    console.log("cursor path calls", g.cursorCalls());
    assert.equal(g.effectCalls(), 96);
    console.log(
      mode,
      opt,
      disabled
        ? "rooted control"
        : cursorDisabled
          ? "borrowed control"
          : "cursor",
      "mutation, boxes, detached ownership and retained GC pass",
    );
  }
  for (const name of ["native", "shadow", "derived"])
    for (const mode of ["NAIVE", "SIMD"])
      for (const opt of ["-O0", "-O3"]) {
        const { g, read, input } = compile(name, mode, opt);
        for (let i = 0; i < 64; i++) {
          const text =
              "汉語 " +
              i +
              ' "\\\n' +
              String.fromCharCode(0xd800 + (i % 16)) +
              (i === 31 ? "x".repeat(32768) : ""),
            ptr = input(text),
            out = g.__pin(g.run(ptr));
          g.__collect();
          assert.equal(
            read(out),
            JSON.stringify({
              child: {
                field: name === "shadow" ? { value: 7 } : 7,
                name: text,
              },
            }),
          );
          g.__unpin(out);
          g.__unpin(ptr);
          identities++;
        }
        assert.equal(g.calls(), name === "native" ? 64 : 0);
        assert.equal(g.cursorCalls(), name === "native" ? 64 : 0);
        console.log(
          name,
          mode,
          opt,
          "identity and GC pass; cursor calls",
          g.cursorCalls(),
        );
      }
  console.log(
    "Borrowed record effects:",
    effects,
    "mutation/boxed/detached checks;",
    identities,
    "alias/shadow/descendant checks; twenty-one configurations",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
