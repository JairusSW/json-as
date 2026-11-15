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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-array-row-"));
let checks = 0;
fs.writeFileSync(
  path.join(dir, "count-gc.mjs"),
  `
import Base from ${JSON.stringify(path.join(root, "transform/lib/index.js"))};
import { SimpleParser } from ${JSON.stringify(path.join(root, "transform/lib/util.js"))};
import { Visitor } from ${JSON.stringify(path.join(root, "transform/lib/visitor.js"))};
export default class extends Base {
  afterParse(parser) {
    super.afterParse(parser);
    const runtime = parser.sources.find(s => s.internalPath === "~lib/rt/itcms");
    const step = runtime.statements.find(n => n.name?.text === "step");
    // Diagnostic after the production eligibility proof: force stock collection
    // at output growth, without adding an application callback or allocation.
    const counter = SimpleParser.parseTopLevelStatement("let rowGcStepCount: i32 = 0;");
    const getter = SimpleParser.parseTopLevelStatement("@global function __rowGcSteps(): i32 { return rowGcStepCount; }");
    const update = SimpleParser.parseStatement("rowGcStepCount++;");
    class BindRange extends Visitor {
      _visit(node, parent) { node.range = runtime.range; super._visit(node, parent); }
    }
    new BindRange().visit([counter, getter, update]);
    const collect = SimpleParser.parseTopLevelStatement("@global function __rowCollect(): void { __collect(); }");
    new BindRange().visit(collect);
    runtime.statements.push(counter, getter, collect);
    const buffer = parser.sources.find(s => s.internalPath === "lib/as-bs");
    const bs = buffer.statements.find(n => n.name?.text === "bs");
    const renew = bs.members.find(n => n.name?.text === "renewBuffer");
    const force = SimpleParser.parseStatement("__rowCollect();");
    new BindRange().visit(force);
    renew.body.statements.unshift(force);
    step.body.statements.unshift(update);
  }
}
`,
);
const row = {
  signed: -1,
  unsigned: 65535,
  wide: 18446744073709551615n,
  enabled: true,
  values: [],
};
const expected = (values) =>
  '{"signed":-1,"unsigned":65535,"wide":18446744073709551615,"enabled":true,"values":' +
  JSON.stringify(values) +
  "}";
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
    for (const runtime of ["incremental", "minimal", "stub", "count-gc"]) {
      const instrumented = runtime === "count-gc";
      const actualRuntime = instrumented ? "incremental" : runtime;
      const output = path.join(dir, "test.wasm");
      const result = spawnSync(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          "assembly/__tests__/array-row.fixture.ts",
          "--transform",
          instrumented ? path.join(dir, "count-gc.mjs") : "./transform",
          "--runtime",
          actualRuntime,
          "-O3",
          "-o",
          output,
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, JSON_MODE: mode, JSON_CACHE: "0" },
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
          new DataView(g.memory.buffer).getUint32(pointer - 4, true) &
            0x7fffffff,
        ).toString("utf16le");
      g = new WebAssembly.Instance(
        new WebAssembly.Module(fs.readFileSync(output)),
        {
          env: {
            abort(message, file, line, column) {
              throw Error(
                `${message ? read(message) : "abort"} at ${file ? read(file) : "unknown"}:${line}:${column} (${mode}/${runtime})`,
              );
            },
          },
        },
      ).exports;
      assert.equal(
        g.selected(),
        actualRuntime === "incremental" ? 1 : 0,
        mode + "/" + runtime,
      );
      assert.equal(
        read(g.verify()),
        '{"rows":[null,' + expected([-2147483648, 0, 2147483647]) + "]}",
      );
      assert.equal(read(g.subclass()), "[" + expected([]) + "]");
      assert.equal(
        read(g.binding()),
        '{"rows":[{"src":-9223372036854775808,"length":9,"i":-7,"pointer":11,"values":[1,2]}]}',
      );
      // Warm a learned output reservation, then outgrow it while only the
      // temporary owning array keeps every managed row and value buffer alive.
      for (const [count, width] of [
        [16, 1024],
        [40, 8000],
        [1, 0],
      ]) {
        const before = g.gcSteps();
        const text = read(g.growth(count, width));
        if (instrumented && count === 40)
          assert.ok(
            g.gcSteps() > before,
            "GC must run during borrowed-row growth",
          );
        const rows = JSON.parse(text);
        assert.equal(rows.length, count);
        for (let i = 0; i < count; i++) {
          assert.equal(rows[i].values.length, width);
          for (let j = 0; j < width; j++)
            assert.equal(rows[i].values[j], i * width + j);
          assert.equal(rows[i].signed, row.signed);
        }
        checks++;
      }
      assert.equal(
        read(g.fallbacks()),
        '{"collisions":[{"value":5}],"customs":[7],"parents":[{"value":8,"other":9}]}',
      );
      assert.equal(
        g.nestedSelected(),
        actualRuntime === "incremental" ? 1 : 0,
        "nested numeric row selection",
      );
      for (const [count, width] of [
        [1, 0],
        [40, 16000],
      ]) {
        const groups = JSON.parse(read(g.nested(count, width)));
        assert.equal(groups.length, count);
        for (let i = 0; i < count; i++) {
          assert.equal(groups[i].tag, 4);
          assert.equal(groups[i].items[0], null);
          assert.equal(groups[i].items[1].values.length, width);
          for (let j = 0; j < width; j++)
            assert.equal(groups[i].items[1].values[j], i * width + j);
        }
        checks++;
      }
      assert.equal(read(g.nestedFallback()), '{"values":[{"items":[7]}]}');
      assert.equal(
        read(g.graphFallbacks()),
        '{"values":[{"items":[]}]}|{"values":[{"children":[]}]}',
      );
      checks += 8;
    }
  }
  console.log(`Array row serialization: ${checks} checks passed`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
