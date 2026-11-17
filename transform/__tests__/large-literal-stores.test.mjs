// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../.."),
  d = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-large-literals-"));
const runtime = path
  .relative(d, path.join(root, "assembly/index"))
  .split(path.sep)
  .join("/");
const aliases = Array.from(
  { length: 16 },
  (_, i) =>
    "long_field_" +
    i +
    "_" +
    ["😀", "\0", '"', "\\", "\u2028", "\u2029", "\ud800", "\uffff"][i % 8],
);
const quote = (s) =>
  JSON.stringify(s)
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
const fields = aliases
  .map(
    (a, i) =>
      `@alias(${quote(a)})f${i}:string=${JSON.stringify("default " + i)};`,
  )
  .join("\n");
fs.writeFileSync(
  d + "/entry.ts",
  `import{JSON}from${JSON.stringify(runtime)};@json({nolazy})class Record{${fields}}
export function allocInput(n:i32):usize{return __new(n,idof<string>());}
export function render(text:string):string{return JSON.stringify(JSON.parse<Record>(text));}
export function first():usize{return __large_probe_start();}export function fence(i:i32):usize{return __large_probe_write(i);}
export function scalar():i32{return JSON.parse<i32>('42');}const __json_large_literal_0:i32=77;const DATA:i32=9;export function collision():i32{return __json_large_literal_0+DATA;}`,
);
fs.appendFileSync(
  d + "/entry.ts",
  [
    { name: "Policy15", fields: 15, strings: 15 },
    { name: "Policy3", fields: 16, strings: 3 },
    { name: "Policy4", fields: 16, strings: 4 },
    { name: "Policy17", fields: 17, strings: 4 },
  ]
    .map(
      (x) =>
        "@json({nolazy})class " +
        x.name +
        "{" +
        Array.from(
          { length: x.fields },
          (_, i) =>
            "long_literal_field_" +
            i +
            ":" +
            (i < x.strings ? 'string=""' : "i32=0") +
            ";",
        ).join("") +
        "}",
    )
    .join("\n"),
);
fs.writeFileSync(
  d + "/transform.mjs",
  `import Base from '${pathToFileURL(path.join(root, "transform/lib/index.js")).href}';import fs from'node:fs';import os from'node:os';import path from'node:path';import{pathToFileURL}from'node:url';import{toString}from'${pathToFileURL(path.join(root, "transform/lib/util.js")).href}';export default class extends Base{afterParse(parser){super.afterParse(parser);const rows=[];for(const s of parser.sources){if(!s.internalPath.startsWith('__json_large_literal_'))continue;const m=/memory.data<u16>\\(\\[([^\\]]*)/.exec(s.text);if(m)rows.push({name:s.internalPath,units:m[1].split(',').map(Number)});}if(!rows.length&&process.env.LITERAL_BASE_CONTROL!=='1')throw Error('Missing selected literal helpers');const selected={};for(const s of parser.sources)for(const n of s.statements){if(!/^Policy/.test(n.name?.text||''))continue;const m=n.members?.find(x=>x.name?.text==='__SERIALIZE');if(m)selected[n.name.text]=toString(m.body).includes('__json_large_literal_');}fs.writeFileSync(process.env.LITERAL_ORACLE_ROWS,JSON.stringify({rows,selected}));parser.parseFile('const ARENA:usize=memory.data(64,16);@global function __large_probe_start():usize{return ARENA;}@global function __large_probe_write(i:i32):usize{memory.fill(ARENA,165,64);switch(i){'+rows.map((x,i)=>'case '+i+':'+x.name+'(ARENA,16);break;').join('')+'}return ARENA+16;}','__json_literal_fence.ts',false);}}`,
);
let checks = 0;
const values = [
  "",
  'a"b',
  "x\0y",
  "\ud800",
  "\udc00",
  "\uffff".repeat(33),
  "漢語\n".repeat(17),
  "😀".repeat(32),
];
for (const runtime of ["incremental", "minimal", "stub"])
  for (const opt of ["-O0", "-O3"]) {
    const out = d + "/" + runtime + "-" + opt.slice(1) + ".wasm",
      rowsFile = d + "/rows.json";
    const log = execFileSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        d + "/entry.ts",
        "--transform",
        d + "/transform.mjs",
        "--runtime",
        runtime,
        "--enable",
        "simd",
        "--exportRuntime",
        opt,
        "-o",
        out,
      ],
      {
        encoding: "utf8",
        maxBuffer: 1e7,
        env: {
          ...process.env,
          JSON_MODE: "SIMD",
          JSON_STRICT: "false",
          JSON_CACHE: "0",
          LITERAL_ORACLE_ROWS: rowsFile,
        },
      },
    );
    assert.doesNotMatch(log, /(?:WARNING|INFO) AS\d+/);
    fs.writeFileSync(out + ".build.log", log);
    let g;
    g = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(out)), {
      env: {
        abort(m, f, l, c) {
          throw Error("abort " + l + ":" + c);
        },
      },
    }).exports;
    const decode = (p) =>
        Buffer.from(
          g.memory.buffer,
          p,
          new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
        ).toString("utf16le"),
      input = (s) => {
        const x = Buffer.from(s, "utf16le"),
          p = g.__pin(g.allocInput(x.length));
        new Uint8Array(g.memory.buffer, p, x.length).set(x);
        return p;
      };
    assert.equal(g.scalar(), 42);
    assert.equal(g.collision(), 86);
    const { rows, selected } = JSON.parse(fs.readFileSync(rowsFile));
    assert.deepEqual(selected, {
      Policy15: false,
      Policy3: false,
      Policy4: true,
      Policy17: true,
    });
    checks += 4;
    for (const [i, row] of rows.entries()) {
      const p = g.fence(i);
      assert.equal(p, g.first() + 16);
      const all = Buffer.from(g.memory.buffer, g.first(), 64),
        bytes = Buffer.alloc(16);
      row.units.forEach((n, j) => bytes.writeUInt16LE(n, j * 2));
      assert.deepEqual(all.subarray(0, 16), Buffer.alloc(16, 165));
      assert.deepEqual(all.subarray(16, 32), bytes);
      assert.deepEqual(all.subarray(32), Buffer.alloc(32, 165));
      checks++;
    }
    const retained = [];
    for (let n = 0; n < values.length; n++) {
      const obj = Object.fromEntries(
          aliases.map((a, i) => [a, values[(n + i) % values.length]]),
        ),
        p = input(JSON.stringify(obj)),
        out = g.__pin(g.render(p));
      g.__unpin(p);
      g.__collect();
      assert.equal(decode(out), JSON.stringify(obj));
      retained.push([out, decode(out)]);
      for (const [p, s] of retained) assert.equal(decode(p), s);
      checks++;
    }
    for (const [p] of retained) g.__unpin(p);
    console.log(
      runtime,
      opt,
      rows.length,
      "positive literal vectors; exact fences and retained outputs pass",
    );
  }
console.log(
  "Large string literals:",
  checks,
  "exact vector-fence/policy/binding/public UTF-16/retained-output checks across six configurations",
);
const startupCounts = [];
for (const unused of [false, true]) {
  const entry = path.join(d, `startup-${unused}.ts`);
  fs.writeFileSync(
    entry,
    `import{JSON}from${JSON.stringify(runtime)};
    export function scalar():i32{return JSON.parse<i32>("42");}
    ${unused ? "@json({nolazy})class UnusedLarge{" + Array.from({ length: 16 }, (_, i) => `zzzzlit_${i}:string="unused";`).join("") + "}" : ""}`,
  );
  const output = path.join(d, `startup-${unused}.wasm`);
  execFileSync(
    process.execPath,
    [
      "node_modules/assemblyscript/bin/asc.js",
      entry,
      "--transform",
      "./transform",
      "--enable",
      "simd",
      "--use",
      "ASC_RTRACE=1",
      "--exportStart",
      "start",
      "-O3",
      "-o",
      output,
    ],
    {
      cwd: root,
      env: { ...process.env, JSON_MODE: "SIMD", JSON_CACHE: "0" },
      stdio: "pipe",
    },
  );
  const bytes = fs.readFileSync(output),
    module = new WebAssembly.Module(bytes);
  assert.equal(bytes.includes(Buffer.from('{"zzzzli', "utf16le")), false);
  let allocations = 0;
  const callbacks = Object.fromEntries(
    WebAssembly.Module.imports(module)
      .filter((entry) => entry.module === "rtrace")
      .map(({ name }) => [
        name,
        (...args) => {
          if (name === "onalloc") allocations++;
          return name === "onvisit" ? 1 : args[0] || 0;
        },
      ]),
  );
  const g = new WebAssembly.Instance(module, {
    env: {
      abort() {
        throw Error("abort");
      },
    },
    rtrace: callbacks,
  }).exports;
  g.start();
  assert.equal(g.scalar(), 42);
  startupCounts.push(allocations);
}
assert.equal(startupCounts[1], startupCounts[0]);
console.log(
  `Unused large literals: no retained vector payload; scalar startup allocations ${startupCounts.join("/")}`,
);
fs.rmSync(d, { recursive: true, force: true });
