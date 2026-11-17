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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-common-escapes-"));
const url = (file) => pathToFileURL(path.join(root, file)).href;
const runtime = path
  .relative(dir, path.join(root, "assembly/index"))
  .split(path.sep)
  .join("/");
const entry = `
import {JSON}from'../../../assembly/index';
@json({nolazy})class Row{a!:string;b!:string;c!:string;}
export function allocInput(n:i32):usize{return __new(n,idof<string>());}
export function scalar(source:string):string{return JSON.stringify(source);}
export function alias(source:string):string{return JSON.stringify<string>(source,source);}
export function staticOut(source:string):string{return JSON.stringify<string>(source,JSON.stringify<bool>(false));}
export function rows(source:string):string{const values=JSON.parse<string[]>(source),rows:Row[]=[];for(let i=0;i<values.length;i++){const row=new Row();row.a=values[i];row.b=values[i];row.c=values[i];rows.push(row);}return JSON.stringify(rows);}
export function calls():i32{return __commonEscapeCallsRead();}
export function privateCalls():i32{return __commonPrivateCallsRead();}

const record=new Row();const reuseRows:Row[]=[record];
export function fields(source:string):string{record.a=source;record.b=source;record.c=source;return JSON.stringify(reuseRows);}

`;
fs.writeFileSync(
  path.join(dir, "entry.ts"),
  entry.replace("'../../../assembly/index'", JSON.stringify(runtime)),
);
fs.writeFileSync(
  path.join(dir, "transform.mjs"),
  `
import Base from ${JSON.stringify(url("transform/lib/index.js"))};
import {Visitor} from ${JSON.stringify(url("transform/lib/visitor.js"))};
import {NodeKind} from ${JSON.stringify(url("transform/lib/types.js"))};
import {SimpleParser,toString} from ${JSON.stringify(url("transform/lib/util.js"))};
import {diagnosticsRuntimeRoot} from ${JSON.stringify(url("transform/lib/diagnostics.js"))};
export default class extends Base{afterParse(parser){super.afterParse(parser);
 const source=parser.sources.find(s=>s.internalPath===diagnosticsRuntimeRoot(parser.sources)+'assembly/serialize/simd/string');
 class Bind extends Visitor{_visit(n,p){n.range=source.range;super._visit(n,p);}}
 class Remove extends Visitor{visitBlockStatement(node,parent){
  node.statements=node.statements.filter(s=>!(s.kind===NodeKind.If&&/0xaaaa|43690/.test(toString(s.condition))&&toString(s.ifTrue).includes('i16x8.bitmask')));
  super.visitBlockStatement(node,parent);
 }}
 let branches=0;
 for(const fn of source.statements.filter(n=>n.name?.text==='serializeStringRangeReservedAt_SIMD'||/^__json_text_record_\\d+_range$/.test(n.name?.text))){
  if(process.env.PROBE_CONTROL==='true'){new Remove().visit(fn.body);continue;}
  let body=toString(fn.body);if(!body.includes('const key'))continue;branches++;
  const counter=fn.name.text==='serializeStringRangeReservedAt_SIMD'?'__commonTestCalls++;':'__commonTestCalls++;__commonPrivateCalls++;';
  body=body.replace('const key',counter+(process.env.PROBE_GC==='true'?'__collect();':'')+'const key');
  if(process.env.PROBE_GC==='true')body=body.replace('const maxGrowth','__collect();const maxGrowth');
  fn.body=SimpleParser.parseStatement(body);new Bind().visit(fn.body);
 }
 const expected=process.env.PROBE_ACTIVE==='true'&&process.env.PROBE_CONTROL!=='true';
 if((branches>0)!==expected)throw Error('Missing kernel selection/fallback');
 const declarations=[SimpleParser.parseTopLevelStatement('let __commonTestCalls:i32=0;'),SimpleParser.parseTopLevelStatement('let __commonPrivateCalls:i32=0;'),SimpleParser.parseTopLevelStatement('@global function __commonEscapeCallsRead():i32{return __commonTestCalls;}'),SimpleParser.parseTopLevelStatement('@global function __commonPrivateCallsRead():i32{return __commonPrivateCalls;}')];
 new Bind().visit(declarations);source.statements.push(...declarations);
}}
`,
);
// Every lane mask, each short escape, mixed escapes and overlapping boundaries.
const values = [],
  glyphs = ['"', "\\", "\b", "\t", "\n", "\f", "\r"];
for (let mask = 0; mask < 256; mask++)
  for (let kind = 0; kind < 8; kind++)
    for (const prefix of [0, 7]) {
      const block = Array.from({ length: 8 }, (_, i) =>
        mask & (1 << i)
          ? glyphs[kind === 7 ? (mask + i * 3) % 7 : kind]
          : String.fromCharCode(65 + i),
      ).join("");
      values.push("x".repeat(prefix) + block + "tail".repeat(8));
    }
for (let code = 0; code < 32; code++)
  for (let position = 0; position < 8; position++)
    values.push(
      "x".repeat(position) +
        "\n" +
        String.fromCharCode(code) +
        "tail".repeat(8),
    );
for (const code of [
  0, 34, 92, 127, 128, 255, 0x080a, 0x7fff, 0x8000, 0xd7ff, 0xd800, 0xdbff,
  0xdc00, 0xdfff, 0xe000, 0xffff,
])
  for (const prefix of [0, 7, 8, 15, 16, 31, 32])
    values.push(
      "x".repeat(prefix) + "\n" + String.fromCharCode(code) + "tail".repeat(8),
    );
values.push(
  '"'.repeat(4096),
  "汉語\n".repeat(100),
  "x".repeat(4096),
  "\u0000".repeat(128),
  "😀\n".repeat(100),
);
const configurations = [
  { mode: "SIMD", runtime: "incremental", opt: "-O0" },
  { mode: "SIMD", runtime: "incremental", opt: "-O3", exhaustive: true },
  { mode: "SIMD", runtime: "incremental", opt: "-O3", gc: true },
  { mode: "SIMD", runtime: "incremental", opt: "-O3", control: true },
  { mode: "SIMD", runtime: "minimal", opt: "-O3" },
  { mode: "SIMD", runtime: "stub", opt: "-O3" },
  { mode: "NAIVE", runtime: "incremental", opt: "-O3" },
  { mode: "SWAR", runtime: "incremental", opt: "-O3" },
];
let checks = 0,
  forced = 0;
try {
  for (const config of configurations) {
    const active = config.mode === "SIMD" && config.runtime === "incremental";
    const output = path.join(dir, "entry.wasm");
    const compiled = spawnSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        path.join(dir, "entry.ts"),
        "--transform",
        path.join(dir, "transform.mjs"),
        "--runtime",
        config.runtime,
        "--exportRuntime",
        config.opt,
        ...(config.mode === "SIMD" ? ["--enable", "simd"] : []),
        "-o",
        output,
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          JSON_MODE: config.mode,
          JSON_STRICT: "false",
          JSON_CACHE: "0",
          PROBE_ACTIVE: String(active),
          PROBE_CONTROL: String(!!config.control),
          PROBE_GC: String(!!config.gc),
        },
      },
    );
    assert.equal(compiled.status, 0, compiled.stderr);
    assert.doesNotMatch(
      compiled.stdout + compiled.stderr,
      /(?:WARNING|INFO) AS\d+/,
    );
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
          abort(m, f, l, c) {
            throw Error(
              "Unexpected Wasm abort: " + (g ? read(m) : m) + " " + l + ":" + c,
            );
          },
        },
      },
    ).exports;
    const input = (text, pin = true) => {
      const bytes = Buffer.from(text, "utf16le"),
        allocated = g.allocInput(bytes.length),
        ptr = pin ? g.__pin(allocated) : allocated;
      new Uint8Array(g.memory.buffer, ptr, bytes.length).set(bytes);
      return ptr;
    };
    // Minimal __renew transfers an existing pin if it moves the allocation.
    // This uninstrumented alias call uses its manual collector without collecting.
    const check = (text, method) => {
      const pinned = !(config.runtime === "minimal" && method === "alias"),
        ptr = input(text, pinned),
        raw = g[method](ptr),
        out = raw === ptr && pinned ? ptr : g.__pin(raw);
      assert.equal(
        read(out),
        JSON.stringify(
          method === "fields" ? [{ a: text, b: text, c: text }] : text,
        ),
      );
      g.__unpin(out);
      if (pinned && out !== ptr) g.__unpin(ptr);
      checks++;
    };
    const selected = config.gc
      ? values
          .slice(0, 512)
          .concat(values.slice(0, 512).map((value) => "語".repeat(8) + value))
      : values;
    for (const text of selected) {
      check(text, "scalar");
      check(text, "fields");
    }
    if (config.exhaustive)
      for (let code = 0; code < 65536; code++) {
        const text = "\n" + String.fromCharCode(code) + "xxxxxx" + "tailtail";
        check(text, "scalar");
        check(text, "fields");
      }
    for (const text of values.slice(0, 256).concat(values.slice(-5))) {
      check(text, "alias");
      check(text, "staticOut");
    }
    const held = [];
    for (let i = 0; i < Math.min(selected.length, 512); i += 16) {
      const group = selected.slice(i, i + 16),
        ptr = input(JSON.stringify(group)),
        out = g.__pin(g.rows(ptr));
      g.__unpin(ptr);
      if (config.runtime !== "stub") g.__collect();
      const expected = JSON.stringify(group.map((a) => ({ a, b: a, c: a })));
      assert.equal(read(out), expected);
      held.push([out, expected]);
      checks += group.length;
    }
    if (config.runtime !== "stub") g.__collect();
    for (const [ptr, expected] of held) {
      assert.equal(read(ptr), expected);
      g.__unpin(ptr);
      checks++;
    }
    assert.equal(
      g.calls() > 0,
      active && !config.control,
      JSON.stringify(config) + " public",
    );
    assert.equal(
      g.privateCalls() > 0,
      active && !config.control,
      JSON.stringify(config) + " private",
    );
    if (config.gc) forced += g.calls();
    console.log(
      config.mode,
      config.runtime,
      config.opt,
      config.gc
        ? "forced-GC"
        : config.control
          ? "original control"
          : "selected/fallback",
      "exact output checks pass",
    );
  }
  console.log(
    "Common escape vectors:",
    checks,
    "exact mask/UTF-16/buffer/alias/row checks;",
    forced,
    "forced common-block collections; eight configurations",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
