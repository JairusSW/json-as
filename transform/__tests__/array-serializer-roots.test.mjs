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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-array-roots-"));
let checks = 0;
function compile(entry, mode, runtime, control = false) {
  const output = path.join(dir, "test.wasm");
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/assemblyscript/bin/asc.js",
      entry,
      "--transform",
      control ? path.join(dir, "control.mjs") : "./transform",
      "--runtime",
      runtime,
      "-O3",
      "-o",
      output,
      ...(mode === "SIMD" ? ["--enable", "simd"] : []),
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
      },
    },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /(?:WARNING|INFO) AS\d+/);
  return fs.readFileSync(output);
}
function instantiate(bytes) {
  let g;
  const read = (p) =>
    Buffer.from(
      g.memory.buffer,
      p,
      new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
    ).toString("utf16le");
  g = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
    env: {
      abort(message) {
        throw Error(read(message));
      },
    },
  }).exports;
  return { g, read };
}
function code(bytes) {
  function leb(offset) {
    let value = 0,
      shift = 0,
      byte;
    do {
      byte = bytes[offset++];
      value |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
    return [value, offset];
  }
  for (let offset = 8; offset < bytes.length;) {
    const id = bytes[offset++];
    const [length, start] = leb(offset);
    if (id === 10) return bytes.subarray(start, start + length);
    offset = start + length;
  }
  throw Error("Missing Wasm code section");
}
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of ["incremental", "minimal", "stub"]) {
      const { g, read } = instantiate(
        compile(
          "assembly/__tests__/array-serializer-roots.fixture.ts",
          mode,
          runtime,
        ),
      );
      assert.equal(g.selected(), 1);
      for (let i = 0; i < 3; i++)
        assert.equal(read(g.verify()), "[null,42]", mode + "/" + runtime);
      assert.equal(read(g.collision()), '[{"text":"x"}]|7:1');
      checks += 5;
    }
  // Removing only the hint must leave excluded writers byte-identical, while
  // changing a string-row writer. This checks real compiler output, not timing.
  fs.writeFileSync(
    path.join(dir, "control.mjs"),
    `
import Transform from ${JSON.stringify(pathToFileURL(path.join(root, "transform/lib/index.js")).href)};
import {Visitor} from ${JSON.stringify(pathToFileURL(path.join(root, "transform/lib/visitor.js")).href)};
class RemoveHints extends Visitor {
  visitClassDeclaration(node) {
    node.members = node.members.filter(member => member.name.text !== "__SERIALIZE_STRING_FIELDS");
    super.visitClassDeclaration(node);
  }
}
export default class extends Transform {
  afterParse(parser) { super.afterParse(parser); for (const source of parser.sources) new RemoveHints().visit(source); }
}
`,
  );
  const cases = [
    [
      "string",
      '@json({nolazy}) class Row { text:string="x"; }',
      "Row",
      '[{"text":"x"}]',
      true,
    ],
    [
      "wide",
      '@json({nolazy}) class Row { n:i64=42; text:string="x"; }',
      "Row",
      '[{"n":42,"text":"x"}]',
      false,
    ],
    [
      "wide alias",
      'type Count=i64; namespace Owner { type i64=i32; @json({nolazy}) export class Row { n:Count=42; text:string="x"; } }',
      "Owner.Row",
      '[{"n":42,"text":"x"}]',
      false,
    ],
    [
      "generic",
      '@json({nolazy}) class Row<T> { n:T=<T>0; text:string="x"; }',
      "Row<i32>",
      '[{"n":0,"text":"x"}]',
      false,
    ],
    [
      "user String",
      "@json({nolazy}) class String { n:i32=1; } @json({nolazy}) class Row { data:String=new String(); }",
      "Row",
      '[{"data":{"n":1}}]',
      false,
    ],
    [
      "native String alias",
      'type Text=String; namespace Owner { @json({nolazy}) class String { n:i32=1; } @json({nolazy}) export class Row { value:Text="x"; } }',
      "Owner.Row",
      '[{"value":"x"}]',
      true,
    ],
  ];
  for (const [name, model, type, expected, selected] of cases) {
    const entry = path.join(dir, "entry.ts");
    fs.writeFileSync(
      entry,
      `import {JSON} from ${JSON.stringify(path.relative(dir, path.join(root, "assembly/index")).split(path.sep).join("/"))};\n${model}\nexport function run():string{return JSON.stringify<${type}[]>([new ${type}()]);}\n`,
    );
    const optimized = compile(entry, "SWAR", "incremental");
    const control = compile(entry, "SWAR", "incremental", true);
    for (const image of [optimized, control]) {
      const { g, read } = instantiate(image);
      assert.equal(read(g.run()), expected, name);
      checks++;
    }
    assert.equal(
      code(optimized).equals(code(control)),
      !selected,
      name + " emission",
    );
    checks++;
  }
  console.log(
    `Array serializer roots: ${checks} GC/receiver/collision/alias/fallback/emission checks passed`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
