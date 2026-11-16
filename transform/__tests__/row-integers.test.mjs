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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-integer-oracle-"));
const limit = 1n << 64n;
const values = new Set([0n, 1n, limit - 1n, 1n << 63n, (1n << 32n) - 1n]);
for (let i = 0n; i < 1000n; i++) values.add(i);
for (let power = 1n; power < limit; power *= 10n)
  for (let delta = -5n; delta <= 5n; delta++)
    if (power + delta >= 0n && power + delta < limit) values.add(power + delta);
let seed = 42n;
for (let i = 0; i < 1000; i++) {
  seed = BigInt.asUintN(64, seed * 6364136223846793005n + 1442695040888963407n);
  values.add(seed);
  values.add(seed & 0xffffffffn);
}
for (let i = 0n; i < 1000n; i++)
  for (const v of [
    100000000n + i,
    999000000n + i * 1000n + 999n,
    123456789n + i * 100003n,
  ]) {
    values.add(v);
    values.add(BigInt.asUintN(64, -v));
  }
let checks = 0;
fs.writeFileSync(
  path.join(dir, "inspect.mjs"),
  `
import Base from ${JSON.stringify(path.join(root, "transform/lib/index.js"))};
import{SimpleParser}from ${JSON.stringify(path.join(root, "transform/lib/util.js"))};
import{Visitor}from ${JSON.stringify(path.join(root, "transform/lib/visitor.js"))};
export default class extends Base {afterParse(parser){
 const source=parser.sources.find(s=>s.internalPath.endsWith('row-integers.fixture'));
 const variant=process.env.JSON_INTEGER_ORACLE;
 if(variant==='collision') {
   const collision=SimpleParser.parseTopLevelStatement('function __json_triplet_0_entry_triplets():void{}');
   class BindCollision extends Visitor{_visit(n,p){n.range=source.range;super._visit(n,p);}}
   new BindCollision().visit(collision);source.statements.push(collision);
 }
 if(variant==='foreign') {
   const input=parser.sources.find(s=>s.internalPath.endsWith('assembly/util/itoa-fast'));
   const fn=input.statements.find(n=>n.name?.text==='itoaFast');
   const counter=SimpleParser.parseTopLevelStatement('let __oracleWriteCount:i32=0;');
   const getter=SimpleParser.parseTopLevelStatement('@global function __oracleCalls():i32{return __oracleWriteCount;}');
   const update=SimpleParser.parseStatement('__oracleWriteCount++;');
   class BindForeign extends Visitor{_visit(n,p){n.range=input.range;super._visit(n,p);}}
   new BindForeign().visit([counter,getter,update]);input.statements.push(counter,getter);fn.body.statements.unshift(update);
 }
 super.afterParse(parser);
 const helpers=parser.sources.flatMap(s=>s.statements).filter(n=>/^__json_triplet_\\d+_entry$/.test(n.name?.text));
 const name=helpers[0]?.name.text;
 console.log('TRIPLET_SELECTED '+Number(!!name));
 if(variant==='collision'&&name==='__json_triplet_0_entry')throw Error('Fresh-name collision');
 const guards=SimpleParser.parseTopLevelStatement('export function guards(value:u64):bool {'+(name?\`const p=memory.data(80);
 memory.fill(p,0xa5,80); \${name}<u32>(p+8,<u32>value);
 for(let i=0;i<8;i++)if(load<u8>(p+i)!=0xa5)return false;
 for(let i=28;i<80;i++)if(load<u8>(p+i)!=0xa5)return false;
 memory.fill(p,0xa5,80); \${name}<i32>(p+8,<i32>value);
 for(let i=0;i<8;i++)if(load<u8>(p+i)!=0xa5)return false;
 for(let i=30;i<80;i++)if(load<u8>(p+i)!=0xa5)return false;
 memory.fill(p,0xa5,80); \${name}<i64>(p+8,<i64>value);
 for(let i=0;i<8;i++)if(load<u8>(p+i)!=0xa5)return false;
 for(let i=50;i<80;i++)if(load<u8>(p+i)!=0xa5)return false;\`:'')+'return true;}');
 const mode=SimpleParser.parseTopLevelStatement('export function guardMode():bool{return '+Boolean(name)+';}');
 class Bind extends Visitor{_visit(n,p){n.range=source.range;super._visit(n,p);}}
 const calls=SimpleParser.parseTopLevelStatement('export function foreignCalls():i32{return '+(variant==='foreign'?'__oracleCalls()':'0')+';}');
 new Bind().visit([guards,mode,calls]);source.statements.push(guards,mode,calls);
}}
`,
);
try {
  for (const { mode, runtime, variant } of [
    ...["NAIVE", "SWAR", "SIMD"].flatMap((mode) =>
      ["incremental", "minimal", "stub"].map((runtime) => ({
        mode,
        runtime,
        variant: "ordinary",
      })),
    ),
    ...["collision", "foreign"].map((variant) => ({
      mode: "SIMD",
      runtime: "incremental",
      variant,
    })),
  ]) {
    const wasm = path.join(dir, "integers.wasm");
    const compiled = execFileSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/row-integers.fixture.ts",
        "--transform",
        path.join(dir, "inspect.mjs"),
        "--exportRuntime",
        "--runtime",
        runtime,
        "-O3",
        "-o",
        wasm,
        ...(mode === "SIMD" ? ["--enable", "simd"] : []),
      ],
      {
        cwd: root,
        env: { ...process.env, JSON_MODE: mode, JSON_INTEGER_ORACLE: variant },
        stdio: "pipe",
      },
    );
    if (runtime === "incremental" && variant !== "foreign")
      assert.match(compiled.toString(), /TRIPLET_SELECTED 1/);
    else assert.doesNotMatch(compiled.toString(), /TRIPLET_SELECTED 1/);
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
    const decode = (ptr) =>
      Buffer.from(
        g.memory.buffer,
        ptr,
        new DataView(g.memory.buffer).getUint32(ptr - 4, true) & 0x7fffffff,
      ).toString("utf16le");
    assert.equal(
      g.guardMode(),
      runtime === "incremental" && variant !== "foreign" ? 1 : 0,
      "positive guard-path selection",
    );
    let count = 0;
    for (const value of values) {
      const signed = BigInt.asIntN(64, value);
      assert.equal(
        decode(g.signed(value)),
        String(signed),
        `${mode}/${runtime}/signed/${value}`,
      );
      assert.equal(
        decode(g.unsigned(value)),
        String(value),
        `${mode}/${runtime}/unsigned/${value}`,
      );
      const expected = `{"s":${signed},"u":${value},"values":[${signed},${BigInt.asIntN(64, ~value)}]}`;
      assert.equal(
        decode(g.compound(value)),
        "[" + expected + "]",
        `${mode}/${runtime}/compound/${value}`,
      );
      assert.equal(g.guards(value), 1, `${mode}/${runtime}/bounds/${value}`);
      checks += 4;
      if (++count % 512 === 0 && runtime !== "stub") g.__collect();
    }
    assert.equal(
      g.foreignCalls() > 0,
      variant === "foreign",
      "modified formatter effects must remain observable",
    );
  }
  console.log(
    `Integer serialization oracle: ${checks} exact root/field/array comparisons and active bounds guards across eleven configurations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
