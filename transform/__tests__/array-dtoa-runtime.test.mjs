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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-array-dtoa-"));
const configs = [];
for (const mode of ["NAIVE", "SWAR", "SIMD"])
  for (const runtime of ["incremental", "minimal", "stub"])
    for (const diagnostics of [false, true])
      configs.push({ mode, runtime, diagnostics, control: "" });
for (const control of ["disabled", "collision", "wrapper"])
  configs.push({
    mode: "SIMD",
    runtime: "incremental",
    diagnostics: true,
    control,
  });
let cases = 0,
  numbers = 0,
  math = 0;
fs.writeFileSync(
  path.join(dir, "probe.mjs"),
  `
import Base from ${JSON.stringify(path.join(root, "transform/lib/index.js"))};
import{SimpleParser}from${JSON.stringify(path.join(root, "transform/lib/util.js"))};
import{Visitor}from${JSON.stringify(path.join(root, "transform/lib/visitor.js"))};
import{Parser}from${JSON.stringify(path.join(root, "node_modules/assemblyscript/dist/assemblyscript.js"))};
import{NodeKind}from${JSON.stringify(path.join(root, "transform/lib/types.js"))};
export default class extends Base {
 afterParse(parser){
  const control=process.env.ARRAY_DTOA_CONTROL;
  const dtoa=parser.sources.find(s=>s.text.includes('function setDecimalResult'));
  const entry=parser.sources.find(s=>s.internalPath.endsWith('array-dtoa.fixture'));
  class Range extends Visitor{constructor(source){super();this.source=source;} _visit(node,parent){node.range=this.source.range;super._visit(node,parent);}}
  if(control==='disabled'){parser.sources.find(s=>s.internalPath.endsWith('assembly/serialize/naive/array')).text+=' // disable selection';}
  if(control==='collision')entry.statements.push(SimpleParser.parseTopLevelStatement('function __json_array_dtoa_buffered():void {}'));
  if(control==='wrapper'){
   const index=parser.sources.find(s=>s.internalPath===dtoa.internalPath.slice(0,-'/assembly/dtoa'.length)+'/index');
   for(const node of index.statements)if(node.members&&node.path)node.members=node.members.filter(member=>member.exportedName.text!=='dtoa_buffered');
   const additionParser=new Parser();additionParser.parseFile([
    'import{dtoa_buffered as __json_test_original}from"./assembly/dtoa";',
    'let __json_test_count:i32=0;',
    'export function dtoa_buffered(p:usize,n:f64):u32{__json_test_count++;return __json_test_original(p,n);}',
    '@global function __json_test_dtoa_calls():i32{return __json_test_count;}',
   ].join('\\n'),index.normalizedPath,false);const additions=additionParser.sources[0].statements;
   for(const node of additions)if(node.kind===NodeKind.Import){const original=index.statements.find(n=>n.path?.value==='./assembly/dtoa');node.internalPath=original.internalPath;}
   new Range(index).visit(additions);index.statements.push(...additions);
  }
  super.afterParse(parser);
  const helper=dtoa.statements.find(n=>/^__json_array_(?:\\d+_)?round10$/.test(n.name?.text||''));
  const selected=entry.statements.find(n=>n.name?.text==='selected');const result=SimpleParser.parseStatement('return '+Number(!!helper)+';');new Range(entry).visit(result);selected.body.statements=[result];
  if(helper){
   const optimized=entry.statements.find(n=>n.name?.text==='optimized');
   class Route extends Visitor{visitCallExpression(node,parent){if(node.expression.kind===NodeKind.Identifier&&node.expression.text==='umul64hiCarry'){node.expression.text=helper.name.text;node.args.splice(1,1);}super.visitCallExpression(node,parent);}}
   new Route().visit(optimized.body);
   if(control==='collision'&&helper.name.text!=='__json_array_1_round10')throw Error('Collision not avoided');
  }
  if(control==='wrapper'){
   const fn=entry.statements.find(n=>n.name?.text==='wrapperCalls');const call=SimpleParser.parseStatement('return __json_test_dtoa_calls();');new Range(entry).visit(call);fn.body.statements=[call];
  }
 }
}
`,
);
try {
  for (const config of configs) {
    const output = path.join(dir, "probe.wasm");
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/array-dtoa.fixture.ts",
        "--transform",
        path.join(dir, "probe.mjs"),
        "--runtime",
        config.runtime,
        "--exportRuntime",
        "-O3",
        "-o",
        output,
        ...(config.mode === "SIMD" ? ["--enable", "simd"] : []),
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          JSON_MODE: config.mode,
          JSON_DIAGNOSTICS: String(config.diagnostics),
          JSON_CACHE: "0",
          ARRAY_DTOA_CONTROL: config.control,
        },
      },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /(?:WARNING|INFO) AS\d+/,
    );
    let g;
    const read = (pointer) =>
      Buffer.from(
        g.memory.buffer,
        pointer,
        new DataView(g.memory.buffer).getUint32(pointer - 4, true) & 0x7fffffff,
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
    assert.equal(
      g.selected(),
      config.control === "disabled" || config.control === "wrapper" ? 0 : 1,
    );
    const mask = (1n << 64n) - 1n;
    let state = 91284317n;
    const random = () =>
      (state = (state * 6364136223846793005n + 1442695040888963407n) & mask);
    const check = (a, c) => {
      const expected = (a * 10n + c) >> 64n;
      assert.equal(BigInt.asUintN(64, g.optimized(a, c)), expected);
      assert.equal(BigInt.asUintN(64, g.reference(a, c)), expected);
      math += 2;
    };
    const edges = [
      0n,
      1n,
      0xffffffffn,
      0x100000000n,
      0x8000000000000000n,
      0x8000000000000006n,
      0xffffffff00000000n,
      0x1999999999999999n,
      0x199999999999999an,
      mask,
    ];
    for (const a of edges) for (const c of edges) check(a, c);
    for (let i = 0; i < 20000; i++) {
      const a = random(),
        c = random();
      check(a, c);
      check(a & 0xffffffff00000000n, c);
    }
    assert.equal(
      read(g.edges()),
      JSON.stringify([
        0,
        -0,
        Number.MIN_VALUE,
        -Number.MIN_VALUE,
        -1e-300,
        1e-6,
        1e-7,
        1e20,
        1e21,
        Number.MAX_VALUE,
        -Number.MAX_VALUE,
        9007199254740992,
        9007199254740994,
        NaN,
        Infinity,
        -Infinity,
      ]),
    );
    const view = new DataView(new ArrayBuffer(8));
    for (const count of [0, 1, 2, 15, 16, 17, 31, 32, 33, 255, 1025])
      for (const narrow of [false, true])
        for (let seed = 0n; seed < 4n; seed++) {
          const text = read(g.emit(count, seed, Number(narrow))),
            actual = JSON.parse(text),
            expected = [];
          let valueState = seed;
          for (let i = 0; i < count; i++) {
            valueState =
              (valueState * 6364136223846793005n + 1442695040888963407n) & mask;
            let value;
            if (narrow) {
              view.setUint32(0, Number(valueState >> 32n), true);
              value = view.getFloat32(0, true);
            } else {
              view.setBigUint64(0, valueState, true);
              value = view.getFloat64(0, true);
            }
            expected.push(
              Number.isFinite(value) ? (value === 0 ? 0 : value) : null,
            );
          }
          if (!narrow) assert.equal(text, JSON.stringify(expected));
          else {
            assert.equal(actual.length, count);
            for (let i = 0; i < count; i++)
              assert.equal(
                actual[i] === null ? null : Math.fround(actual[i]),
                expected[i],
              );
          }
          cases++;
          numbers += count;
        }
    if (config.control === "wrapper")
      assert.ok(g.wrapperCalls() > 0, "An application wrapper must still run");
  }
  const scalar = path.join(dir, "scalar.ts");
  const scalarTransform = path.join(dir, "scalar-transform.mjs");
  fs.writeFileSync(
    scalar,
    `import {JSON} from ${JSON.stringify(path.relative(dir, path.join(root, "assembly/index")).split(path.sep).join("/"))};export function scalar(bits:u64):string{return JSON.stringify<f64>(reinterpret<f64>(bits));}`,
  );
  fs.writeFileSync(
    scalarTransform,
    `import Base from ${JSON.stringify(path.join(root, "transform/lib/index.js"))};export default class extends Base{afterParse(parser){if(process.env.ARRAY_DTOA_CONTROL==='disabled')parser.sources.find(s=>s.internalPath.endsWith('assembly/serialize/naive/array')).text+=' // disable selection';super.afterParse(parser);}}`,
  );
  const scalarImages = [];
  for (const control of ["", "disabled"]) {
    const output = path.join(dir, "scalar.wasm");
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        scalar,
        "--transform",
        scalarTransform,
        "--runtime",
        "incremental",
        "-O3",
        "-o",
        output,
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          JSON_MODE: "SWAR",
          JSON_CACHE: "0",
          ARRAY_DTOA_CONTROL: control,
        },
      },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /(?:WARNING|INFO) AS\d+/,
    );
    scalarImages.push(fs.readFileSync(output));
  }
  assert.deepEqual(
    scalarImages[0],
    scalarImages[1],
    "Scalar-only Wasm must remain byte-identical",
  );
  console.log(
    `Array dtoa runtime: ${math} exact math checks; ${cases} arrays / ${numbers} numeric values across ${configs.length} mode/runtime/diagnostic/control configurations; scalar-only image unchanged`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
