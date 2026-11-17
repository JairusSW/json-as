// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const d = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-text-records-"));
let checks = 0;

const values = [
  "",
  "a",
  "ab",
  "abc",
  "汉语字",
  "é水字",
  "😀x",
  "\ud800ab",
  "ab\udc00",
  'a"b',
  "a\\b",
  "a\nb",
];
for (let n = 0; n <= 97; n++)
  for (const x of [
    "",
    '"',
    "\\",
    "\0",
    "\n",
    "\ud800",
    "\udc00",
    "😀",
    "\uffff",
  ])
    values.push("x".repeat(n) + x + "z".repeat(n % 7));
for (const n of [16, 17, 31, 32, 33, 63, 64, 65, 127, 128, 129]) {
  for (const fill of ["a", "語", "😀"]) {
    values.push(fill.repeat(n));
    for (const pos of [0, 7, 8, 15, 16, 31])
      for (const special of ['"', "\\", "\n", "\ud800", "\udc00"])
        values.push(fill.repeat(pos) + special + fill.repeat(n));
  }
}
// Mix saturation edges and specials across both halves of each packed block.
const packedEdges = [
  31, 34, 92, 32767, 32768, 55295, 55296, 56319, 56320, 57343, 57344, 65535,
];
for (const block of [0, 16, 32, 48])
  for (const lane of [0, 7])
    for (const first of packedEdges)
      for (const second of packedEdges) {
        const chars = Array(64).fill("語");
        chars[block + lane] = String.fromCharCode(first);
        chars[block + lane + 8] = String.fromCharCode(second);
        values.push(chars.join(""));
      }
fs.writeFileSync(
  d + "/inspect.mjs",
  `
import Base from ${JSON.stringify(path.join(root, "transform/lib/index.js"))};
import {SimpleParser} from ${JSON.stringify(path.join(root, "transform/lib/util.js"))};
import {Visitor} from ${JSON.stringify(path.join(root, "transform/lib/visitor.js"))};
export default class extends Base{afterParse(parser){
 const fixture=parser.sources.find(s=>s.internalPath.endsWith('text-records.fixture'));
 const variant=process.env.TEXT_RECORD_CASE;
 if(variant==='collision'){
  const collision=SimpleParser.parseTopLevelStatement('function __json_text_record_0_entry():void{}');
  class Bind extends Visitor{_visit(n,p){n.range=fixture.range;super._visit(n,p);}}new Bind().visit(collision);fixture.statements.push(collision);
 }
 if(variant==='foreign'||variant==='foreign-range'){
  const src=parser.sources.find(s=>s.internalPath.endsWith('assembly/serialize/simd/string'));
  const fn=src.statements.find(n=>n.name?.text===(variant==='foreign'?'serializeShortStringReservedAt_SIMD':'serializeStringRangeReservedAt_SIMD'));
  const vars=[SimpleParser.parseTopLevelStatement('let __textOracleCalls:i32=0;'),SimpleParser.parseTopLevelStatement('@global function __textOracleCallsRead():i32{return __textOracleCalls;}')];
  const count=SimpleParser.parseStatement('__textOracleCalls++;');
  class Bind extends Visitor{_visit(n,p){n.range=src.range;super._visit(n,p);}}new Bind().visit([...vars,count]);src.statements.push(...vars);fn.body.statements.unshift(count);
 }
 super.afterParse(parser);
 const helpers=parser.sources.flatMap(s=>s.statements).filter(n=>/^__json_text_record_\\d+_short$/.test(n.name?.text));
 const long=parser.sources.flatMap(s=>s.statements).find(n=>/^__json_text_record_\\d+_range$/.test(n.name?.text));
 if(variant==='gc'){
  if(!long)throw Error('Missing long helper for forced-GC test');
  const src=long.range.source;
  const globals=[SimpleParser.parseTopLevelStatement('let __longGcProbes:i32=0;'),SimpleParser.parseTopLevelStatement('@global function __longGcProbesRead():i32{return __longGcProbes;}')];
  const collect=SimpleParser.parseStatement('{__longGcProbes++;__collect();}');
  class BindGc extends Visitor{_visit(n,p){n.range=src.range;super._visit(n,p);}}new BindGc().visit([...globals,collect]);src.statements.push(...globals);long.body.statements.unshift(collect);
 }
 console.log('TEXT_RECORD_SELECTED '+Number(!!helpers.length));
 if(variant==='collision'&&helpers[0]?.name.text==='__json_text_record_0_short')throw Error('Name collision');
 const getter=SimpleParser.parseTopLevelStatement('export function foreignCalls():i32{return '+(variant.startsWith('foreign')?'__textOracleCallsRead()':'0')+';}');
 class Bind extends Visitor{_visit(n,p){n.range=fixture.range;super._visit(n,p);}}new Bind().visit(getter);fixture.statements.push(getter);const probes=SimpleParser.parseTopLevelStatement('export function probes():i32{return '+(variant==='gc'?'__longGcProbesRead()':'0')+';}');new Bind().visit(probes);fixture.statements.push(probes);
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
    ...["collision", "foreign", "foreign-range", "gc"].map((variant) => ({
      mode: "SIMD",
      runtime: "incremental",
      variant,
    })),
  ]) {
    const log = execFileSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/text-records.fixture.ts",
        "--transform",
        d + "/inspect.mjs",
        "--runtime",
        runtime,
        ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        "--exportRuntime",
        "-O3",
        "-o",
        d + "/" + runtime + ".wasm",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          JSON_MODE: mode,
          JSON_CACHE: "0",
          TEXT_RECORD_CASE: variant,
        },
        maxBuffer: 1e7,
      },
    );
    if (runtime === "incremental" && !variant.startsWith("foreign"))
      assert.match(log, /TEXT_RECORD_SELECTED 1/);
    else assert.match(log, /TEXT_RECORD_SELECTED 0/);
    assert.doesNotMatch(log, /(?:WARNING|INFO) AS\d+/);
    fs.writeFileSync(d + "/" + runtime + ".build.log", log);
    let g;
    g = new WebAssembly.Instance(
      new WebAssembly.Module(fs.readFileSync(d + "/" + runtime + ".wasm")),
      {
        env: {
          abort(m, f, l, c) {
            throw Error(
              "abort " +
                l +
                ":" +
                c +
                " message=" +
                m +
                " file=" +
                f +
                " " +
                (g
                  ? Buffer.from(
                      g.memory.buffer,
                      m,
                      new DataView(g.memory.buffer).getUint32(m - 4, true) &
                        0x7fffffff,
                    ).toString("utf16le")
                  : ""),
            );
          },
        },
      },
    ).exports;
    const decode = (p) =>
      Buffer.from(
        g.memory.buffer,
        p,
        new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
      ).toString("utf16le");
    const input = (s) => {
      const bytes = Buffer.from(s, "utf16le"),
        p = g.__pin(g.allocInput(bytes.length));
      new Uint8Array(g.memory.buffer, p, bytes.length).set(bytes);
      return p;
    };
    const held = [];
    for (let i = 0; i < values.length; i += 64) {
      const v = values.slice(i, i + 64),
        p = input(JSON.stringify(v)),
        o = g.__pin(g.run(p));
      g.__unpin(p);
      if (runtime !== "stub") g.__collect();
      const expected = JSON.stringify(v.map((x) => ({ a: x, b: x, c: x })));
      assert.equal(decode(o), expected);
      held.push([o, expected]);
      checks += v.length;
      for (const [o, e] of held) assert.equal(decode(o), e);
    }
    for (const s of values) {
      const p = input(s),
        o = g.__pin(g.reuse(p));
      g.__unpin(p);
      assert.equal(decode(o), JSON.stringify([{ a: s, b: s, c: s }]));
      g.__unpin(o);
      checks++;
    }

    for (const [o] of held) g.__unpin(o);
    if (variant === "foreign") {
      const before = g.foreignCalls(),
        p = input("abc"),
        o = g.__pin(g.reuse(p));
      assert.equal(
        g.foreignCalls() - before,
        3,
        "preserve modified short writer callbacks",
      );
      g.__unpin(p);
      g.__unpin(o);
    }
    if (variant === "foreign-range") {
      const source = "語".repeat(64),
        p = input(source),
        before = g.foreignCalls();
      const out = g.__pin(g.reuse(p));
      assert.equal(
        g.foreignCalls() - before,
        3,
        "preserve modified long writer callbacks",
      );
      assert.equal(
        decode(out),
        JSON.stringify([{ a: source, b: source, c: source }]),
      );
      g.__unpin(p);
      g.__unpin(out);
      checks++;
    }
    if (variant === "gc") {
      const source = "語".repeat(64);
      for (const n of [1, 64, 257]) {
        const p = input(source),
          before = g.probes(),
          out = g.__pin(g.ephemeral(p, n));
        assert.equal(
          g.probes() - before,
          3 * n,
          "collection actually runs in every long field",
        );
        g.__unpin(p);
        g.__collect();
        assert.equal(
          decode(out),
          JSON.stringify(
            Array.from({ length: n }, (_, i) => ({
              a: source + i,
              b: i + source,
              c: source + ":" + i,
            })),
          ),
        );
        g.__unpin(out);
        checks++;
      }
    }
    if (mode !== "SIMD" || variant === "gc") continue;
    let extra = 0;
    const check = (s) => {
      const p = input(s),
        o = g.__pin(g.reuse(p));
      g.__unpin(p);
      assert.equal(decode(o), JSON.stringify([{ a: s, b: s, c: s }]));
      g.__unpin(o);
      checks++;
      if (++extra % 1024 === 0 && runtime !== "stub") g.__collect();
    };
    for (let code = 0; code < 65536; code++) {
      const c = String.fromCharCode(code);
      check(c + "ab");
      check("a" + c + "b");
      check("ab" + c);
    }
    if (
      runtime === "incremental" &&
      ["ordinary", "collision"].includes(variant)
    )
      for (let code = 0; code < 65536; code++)
        for (const pos of [0, 7, 8, 15, 16, 31]) {
          const chars = Array(32).fill("語");
          chars[pos] = String.fromCharCode(code);
          check(chars.join(""));
        }
    const edge = [
      0, 1, 31, 32, 33, 34, 35, 92, 127, 128, 256, 32767, 32768, 55295, 55296,
      56319, 56320, 57343, 57344, 65535,
    ];
    for (const a of edge)
      for (const c of edge)
        for (const z of edge) check(String.fromCharCode(a, c, z));
    let seed = 77;
    for (let i = 0; i < 65536; i++) {
      const c = [];
      for (let j = 0; j < 3; j++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        c.push(seed >>> 16);
      }
      check(String.fromCharCode(...c));
    }
  }
} finally {
  fs.rmSync(d, { recursive: true, force: true });
}
console.log(
  "Text record writers:",
  checks,
  "exact record/reuse checks across thirteen configurations, with positive selection, collision, modified short/long writer fallback, forced collection in ephemeral rows, and retained-output GC",
);
