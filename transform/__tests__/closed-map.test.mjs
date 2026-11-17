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

const root = path.resolve(import.meta.dirname, "../.."),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-closed-map-"));
const url = (name) => JSON.stringify(path.join(root, name));
const asm = (name) =>
  JSON.stringify(
    path.relative(dir, path.join(root, name)).split(path.sep).join("/"),
  );
const fixture =
  "import {JSON}fromRUNTIME_IMPORT;\n@json({nolazy})class Leaf{n:i32=7;text:string='hello';}\n@json({nolazy})class Row{leaf:Leaf=new Leaf();items:i32[]=[1,2,3];}\nexport function allocInput(n:i32):usize{return __new(n,idof<string>());}\nexport function pure():string{const map=new Map<string,Row>();map.set('a',new Row());map.set('b',new Row());return JSON.stringify(map);}\nexport function nullable():string{const map=new Map<string,Row|null>();map.set('a',new Row());map.set('b',null);return JSON.stringify(map);}\nlet owner=new Map<string,Token>();let effects:i32=0;\n@json class Token{value:i32=1;@serializer('number')encode(self:Token):string{effects++;owner.delete('b');owner.set('c',new Token());__collect();return self.value.toString();}}\nexport function mutation():string{effects=0;owner=new Map<string,Token>();owner.set('a',new Token());owner.set('b',new Token());return JSON.stringify(owner);}\nexport function effectCount():i32{return effects;}\nexport function scans():i32{return __staticProofEntriesRead();}\nexport function skips():i32{return __staticProofSkipsRead();}\nexport function reset():void{__staticProofReset();}\n@json class ParentLeaf{n:i32=1;}\n@json class DerivedLeaf extends ParentLeaf{extra:i32=2;}\n@json class CarriesBase{child:ParentLeaf=new DerivedLeaf();}\n@json class Deferred{value:i32=7;}\n@json class Model{n:i32=22;}\nimport {Model as RemoteModel}from'./foreign';\nexport function numericKeys():string{const map=new Map<i32,Row>();map.set(7,new Row());map.set(8,new Row());return JSON.stringify(map);}\nexport function derived():string{const map=new Map<string,CarriesBase>();map.set('a',new CarriesBase());return JSON.stringify(map);}\nexport function deferred():string{const map=new Map<string,Deferred>();map.set('a',new Deferred());return JSON.stringify(map);}\nexport function foreign():string{const map=new Map<string,RemoteModel>();map.set('a',new RemoteModel());return JSON.stringify(map);}\nexport function local():string{const map=new Map<string,Model>();map.set('a',new Model());return JSON.stringify(map);}\n";
const foreign =
  "import {JSON}fromRUNTIME_IMPORT;\n@json export class Model{n:i32=11;}\n";
fs.writeFileSync(
  path.join(dir, "entry.ts"),
  fixture.replace("RUNTIME_IMPORT", asm("assembly/index")) +
    "\nimport {canSnapshotCallbackKeys}from " +
    asm("assembly/util/runtime") +
    ";export function capable():bool{return canSnapshotCallbackKeys();}\nconst __json_map_pure_0:i32=42;export function collision():i32{return __json_map_pure_0;}\n",
);
fs.writeFileSync(
  path.join(dir, "foreign.ts"),
  foreign.replace("RUNTIME_IMPORT", asm("assembly/index")),
);
fs.writeFileSync(
  path.join(dir, "transform.mjs"),
  `
import Base from ${url("transform/lib/index.js")};
import {ClosedMapProof}from ${url("transform/lib/closed-map.js")};
import {SimpleParser,toString}from ${url("transform/lib/util.js")};
import {Visitor}from ${url("transform/lib/visitor.js")};
export default class extends Base{afterParse(parser){
 if(process.env.HIDDEN_MODEL==='1')parser.parseFile('class HiddenDerived extends BaseModel{__SERIALIZE(ptr:usize):void{hiddenEffect();}} @global export function makeHidden():BaseModel{return new HiddenDerived();}','~lib/util/hidden-derived.ts',false);
 const source=parser.sources.find(s=>s.internalPath.endsWith('assembly/serialize/naive/map'));
 if(process.env.SOURCE_CONTROL==='text')source.text+=' // source proof control';
 if(process.env.SOURCE_CONTROL==='ast'){const fn=source.statements.find(n=>n.name?.text==='canSerializeMapWithoutCallbacks');const statement=SimpleParser.parseStatement('if(false)return true;');class Bind extends Visitor{_visit(n,p){n.range=source.range;super._visit(n,p);}}new Bind().visit(statement);fn.body.statements.unshift(statement);}
 const lower=ClosedMapProof.prototype.lower;
 if(process.env.PROOF_CONTROL==='1')ClosedMapProof.prototype.lower=function(){};
 try{super.afterParse(parser);}finally{ClosedMapProof.prototype.lower=lower;}
 const fn=source.statements.find(n=>n.name?.text==='canSerializeMapWithoutCallbacks');let body=toString(fn.body);const needle='if (!JSON.__serializeCallbackFree';if(body.split(needle).length!==2)throw Error('Missing prepass');body=body.replace(needle,'__staticProofEntries++;'+needle);fn.body=SimpleParser.parseStatement(body);
 class Mark extends Visitor{visitIfStatement(node,parent){if(toString(node.condition).includes('__json_map_pure_')&&/^return true;?$/.test(toString(node.ifTrue).trim()))node.ifTrue=SimpleParser.parseStatement('{__staticProofSkips++;__collect();return true;}');super.visitIfStatement(node,parent);}}
 new Mark().visit(fn.body);
 const vars=['let __staticProofEntries:i32=0;','let __staticProofSkips:i32=0;','@global function __staticProofEntriesRead():i32{return __staticProofEntries;}','@global function __staticProofSkipsRead():i32{return __staticProofSkips;}','@global function __staticProofReset():void{__staticProofEntries=0;__staticProofSkips=0;}'].map(s=>SimpleParser.parseTopLevelStatement(s));class Bind extends Visitor{_visit(n,p){n.range=source.range;super._visit(n,p);}}new Bind().visit([fn.body,...vars]);source.statements.push(...vars);
}}
`,
);
const configs = [];
for (const mode of ["NAIVE", "SWAR", "SIMD"])
  for (const runtime of ["incremental", "minimal", "stub"])
    for (const opt of ["-O0", "-O3"])
      for (const control of [true, false])
        configs.push({ mode, runtime, opt, control });
for (const source of ["text", "ast"])
  configs.push({
    mode: "SWAR",
    runtime: "incremental",
    opt: "-O3",
    control: false,
    source,
  });
let checks = 0;
const build = (entry, config, hidden = false) => {
  const wasm = path.join(dir, "probe.wasm"),
    r = spawnSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        entry,
        "--transform",
        path.join(dir, "transform.mjs"),
        "--runtime",
        config.runtime,
        "--exportRuntime",
        config.opt,
        "-o",
        wasm,
        ...(config.mode === "SIMD" ? ["--enable", "simd"] : []),
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          JSON_MODE: config.mode,
          JSON_CACHE: "0",
          PROOF_CONTROL: config.control ? "1" : "0",
          SOURCE_CONTROL: config.source || "",
          HIDDEN_MODEL: hidden ? "1" : "0",
        },
      },
    );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout + r.stderr, /(?:WARNING|INFO) AS\d+/);
  let g;
  g = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(wasm)), {
    env: {
      abort(m, f, l, c) {
        throw Error("abort " + l + ":" + c);
      },
    },
  }).exports;
  const read = (p) =>
    Buffer.from(
      g.memory.buffer,
      p,
      new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
    ).toString("utf16le");
  return { g, read };
};
try {
  for (const config of configs) {
    const { g, read } = build(path.join(dir, "entry.ts"), config),
      capable = !!g.capable(),
      selected = capable && !config.control && !config.source,
      held = [];
    const leaf = { n: 7, text: "hello" },
      value = { leaf, items: [1, 2, 3] };
    const cases = [
      ["pure", { a: value, b: value }, true, 2],
      ["nullable", { a: value, b: null }, true, 2],
      ["numericKeys", { 7: value, 8: value }, false, 2],
      ["derived", { a: { child: { n: 1, extra: 2 } } }, false, 1],
      ["deferred", { a: { value: 7 } }, true, 1],
      ["foreign", { a: { n: 11 } }, true, 1],
      ["local", { a: { n: 22 } }, true, 1],
    ];
    for (const [name, expected, eligible, count] of cases) {
      g.reset();
      const out = g.__pin(g[name]());
      g.__collect();
      assert.deepEqual(JSON.parse(read(out)), expected);
      assert.equal(g.skips(), eligible && selected ? 1 : 0);
      assert.equal(g.scans(), capable && !(eligible && selected) ? count : 0);
      held.push([out, read(out)]);
      checks += 3;
    }
    g.reset();
    const out = g.__pin(g.mutation());
    g.__collect();
    assert.equal(read(out), '{"a":1}');
    assert.equal(g.effectCount(), 1);
    assert.equal(g.skips(), 0);
    assert.equal(g.scans() > 0, capable);
    held.push([out, read(out)]);
    checks += 4;
    for (const [p, s] of held) {
      assert.equal(read(p), s);
      g.__unpin(p);
      checks++;
    }
    assert.equal(g.collision(), 42);
    checks++;
  }
  const hidden =
    "import {JSON}from'../../../assembly/index';\n@global @json class BaseModel{n:i32=1;}\nlet owner=new Map<string,BaseModel>();\n@global export function hiddenEffect():void{owner.delete('b');for(let i=0;i<128;i++)owner.set('x'+i.toString(),new BaseModel());JSON.__serialize<i32>(9);}\nexport function run():string{owner=new Map<string,BaseModel>();owner.set('a',makeHidden());owner.set('b',new BaseModel());return JSON.stringify(owner);}\n";
  for (const exported of [false, true]) {
    fs.writeFileSync(
      path.join(dir, "hidden.ts"),
      hidden
        .replace("'../../../assembly/index'", asm("assembly/index"))
        .replace(
          "@global @json class BaseModel",
          exported
            ? "@global @json export class BaseModel"
            : "@global @json class BaseModel",
        ),
    );
    for (const mode of ["NAIVE", "SWAR", "SIMD"])
      for (const control of [false, true]) {
        const { g, read } = build(
          path.join(dir, "hidden.ts"),
          { mode, runtime: "incremental", opt: "-O3", control },
          true,
        );
        const p = g.__pin(g.run());
        g.__collect();
        assert.equal(read(p), '{"a":9}');
        g.__unpin(p);
        checks++;
      }
  }
  console.log(
    "Closed Map proofs:",
    checks,
    "output/prepass/GC/binding/guard checks across",
    configs.length + 12,
    "configurations",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
