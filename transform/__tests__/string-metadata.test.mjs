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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-string-metadata-"));
const moduleUrl = (file) => pathToFileURL(path.join(root, file)).href;
const runtimePath = path
  .relative(dir, path.join(root, "assembly/index"))
  .split(path.sep)
  .join("/");
fs.writeFileSync(
  path.join(dir, "entry.ts"),
  `
import { JSON } from ${JSON.stringify(runtimePath)};
@json({ nolazy }) class Row { first: string = ''; second: string = ''; }
export function allocInput(bytes: i32): usize { return __new(bytes, idof<string>()); }
export function scalar(input: string): string { return JSON.stringify(input); }
export function fields(input: string): string {
  const row = new Row(); row.first = input; row.second = input;
  return JSON.stringify(row);
}
export function inputSize(input: string): u32 { return load<u32>(changetype<usize>(input) - 4); }
`,
);
fs.writeFileSync(
  path.join(dir, "transform.mjs"),
  `
import Base from ${JSON.stringify(moduleUrl("transform/lib/index.js"))};
import { Visitor } from ${JSON.stringify(moduleUrl("transform/lib/visitor.js"))};
import { SimpleParser, toString } from ${JSON.stringify(moduleUrl("transform/lib/util.js"))};
function stripGuard(node) {
  if (node.left && node.right) {
    if (toString(node.left) === 'STRING_CLEAN_FLAG != 0') return node.right;
    node.left = stripGuard(node.left);
    node.right = stripGuard(node.right);
  }
  return node;
}
export default class extends Base {
  afterParse(parser) {
    super.afterParse(parser);
    const source = parser.sources.find(s => s.internalPath.endsWith('/serialize/simd/string'));
    if (!source) throw Error('Missing SIMD writer');
    let flags = 0, guards = 0;
    class Edit extends Visitor {
      visitVariableDeclaration(node, parent) {
        if (node.name.text === 'STRING_CLEAN_FLAG') {
          node.initializer = SimpleParser.parseExpression(process.env.PROBE_FLAG);
          flags++;
        }
        super.visitVariableDeclaration(node, parent);
      }
      visitIfStatement(node, parent) {
        if (toString(node.condition).includes('STRING_CLEAN_FLAG != 0')) {
          guards++;
          if (process.env.PROBE_CONTROL === 'true') node.condition = stripGuard(node.condition);
        }
        super.visitIfStatement(node, parent);
      }
    }
    new Edit().visit(source);
    if (flags !== 1 || guards !== 2) throw Error('Missing compile-time metadata guards: ' + flags + '/' + guards);
  }
}
`,
);
let checks = 0;
try {
  for (const runtime of ["incremental", "minimal", "stub"]) {
    for (const flag of [0, 1]) {
      const images = [];
      for (const control of [false, true]) {
        const output = path.join(dir, "entry.wasm");
        const log = execFileSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            path.join(dir, "entry.ts"),
            "--transform",
            path.join(dir, "transform.mjs"),
            "--enable",
            "simd",
            "--exportRuntime",
            "--runtime",
            runtime,
            "-O3",
            "-o",
            output,
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              JSON_MODE: "SIMD",
              JSON_STRICT: "false",
              JSON_CACHE: "0",
              PROBE_FLAG: String(flag),
              PROBE_CONTROL: String(control),
            },
            stdio: "pipe",
          },
        );
        assert.doesNotMatch(log.toString(), /(?:WARNING|INFO) AS\d+/);
        const bytes = fs.readFileSync(output);
        images.push(bytes);
        // Synthetic nonzero flags test emission only: the installed runtime
        // does not implement metadata-aware string sizes.
        if (flag !== 0) continue;
        let g;
        const read = (ptr) =>
          Buffer.from(
            g.memory.buffer,
            ptr,
            new DataView(g.memory.buffer).getUint32(ptr - 4, true),
          ).toString("utf16le");
        g = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
          env: {
            abort() {
              throw Error("Unexpected Wasm abort");
            },
          },
        }).exports;
        for (const value of [
          "a".repeat(64),
          '"\\\n'.repeat(40),
          "漢字😀".repeat(30),
          "\ud800".repeat(24),
          "abc",
          "",
        ]) {
          const source = Buffer.from(value, "utf16le");
          const input = g.__pin(g.allocInput(source.length));
          new Uint8Array(g.memory.buffer, input, source.length).set(source);
          const scalar = g.__pin(g.scalar(input));
          const fields = g.__pin(g.fields(input));
          if (runtime !== "stub") g.__collect();
          assert.equal(read(scalar), JSON.stringify(value));
          assert.equal(
            read(fields),
            JSON.stringify({ first: value, second: value }),
          );
          assert.equal(g.inputSize(input), source.length);
          g.__unpin(fields);
          g.__unpin(scalar);
          g.__unpin(input);
          checks += 3;
        }
      }
      assert.equal(
        images[0].equals(images[1]),
        flag !== 0,
        "Only a zero flag should change emitted code: " + runtime + "/" + flag,
      );
      checks++;
    }
  }
  console.log(
    "String metadata: " +
      checks +
      " output/header/emission checks across twelve builds",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
