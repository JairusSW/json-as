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
import { SimpleParser, toString } from ${JSON.stringify(path.join(root, "transform/lib/util.js"))};
import { Visitor } from ${JSON.stringify(path.join(root, "transform/lib/visitor.js"))};
import { NodeKind } from ${JSON.stringify(path.join(root, "transform/lib/types.js"))};
export default class extends Base {
  afterParse(parser) {
    super.afterParse(parser);
    const capacity = parser.sources.flatMap(s => s.statements).find(n => /^__json_numeric_batch_\\d+_capacity$/.test(n.name?.text));
    if (!capacity) throw Error("Missing numeric batch capacity helper");
    const entry = parser.sources.find(s => s.internalPath.endsWith("array-row.fixture"));
    const probe = SimpleParser.parseTopLevelStatement('export function rowBatchCapacity(count:u32):u64 { const header=memory.data<u64>([0,0,0,0]); store<u32>(header,count,offsetof<Array<i32>>("length_"));return ' + capacity.name.text + '<Array<i32>>(header); }');
    class BindProbe extends Visitor { _visit(node,parent) { node.range=entry.range;super._visit(node,parent); } }
    new BindProbe().visit(probe);entry.statements.push(probe);
    if(process.env.PROBE_BATCH_FALLBACK === "true") {
      let branches=0;
      class ForceFallback extends Visitor {
        visitIfStatement(node,parent) {
          if (/^__json_numeric_batch_\\d+_bytes > (?:1073741823|0x3fffffff)$/.test(toString(node.condition))) {
            node.condition=SimpleParser.parseExpression("true");branches++;
          }
          super.visitIfStatement(node,parent);
        }
      }
      for(const source of parser.sources)for(const fn of source.statements)
        if(/^__json_as_flat_strings_\\d+_write$/.test(fn.name?.text))new ForceFallback().visit(fn.body);
      if(!branches)throw Error("Missing numeric batch overflow fallback");
    }
    const runtime = parser.sources.find(s => s.internalPath === "~lib/rt/itcms");
    const step = runtime.statements.find(n => n.name?.text === "step");
    // Diagnostic after the production eligibility proof: force stock collection
    // at output growth, without adding an application callback or allocation.
    const counter = SimpleParser.parseTopLevelStatement("let rowGcStepCount: i32 = 0;");
    const getter = SimpleParser.parseTopLevelStatement("@global function __rowGcSteps(): i32 { return rowGcStepCount; }");
    const batchCounter = [
      SimpleParser.parseTopLevelStatement("let rowBatchCount:i32=0;"),
      SimpleParser.parseTopLevelStatement("let rowFallbackCount:i32=0;"),
      SimpleParser.parseTopLevelStatement("@global function __rowBatchHit():void { rowBatchCount++; }"),
      SimpleParser.parseTopLevelStatement("@global function __rowBatchFallbackHit():void { rowFallbackCount++; }"),
      SimpleParser.parseTopLevelStatement("@global function __rowBatchHits():i32 { return rowBatchCount; }"),
      SimpleParser.parseTopLevelStatement("@global function __rowBatchFallbackHits():i32 { return rowFallbackCount; }")
    ];
    const update = SimpleParser.parseStatement("rowGcStepCount++;");
    class BindRange extends Visitor {
      _visit(node, parent) { node.range = runtime.range; super._visit(node, parent); }
    }
    new BindRange().visit([counter, getter, update]);
    new BindRange().visit(batchCounter);runtime.statements.push(...batchCounter);
    class ObserveBatches extends Visitor {
      visitBlockStatement(node,parent) {
        for(let i=0;i<node.statements.length;i++) {
          const statement=node.statements[i];
          if(statement.kind===NodeKind.Expression && statement.expression.kind===NodeKind.Call && toString(statement.expression.expression).endsWith(".proposeSize")) {
            const hit=SimpleParser.parseStatement("__rowBatchHit();");new BindRange().visit(hit);node.statements.splice(i++,0,hit);
          }
        }
        super.visitBlockStatement(node,parent);
      }
    }
    for(const source of parser.sources)for(const fn of source.statements) {
      if(/^__json_as_flat_strings_\\d+_write$/.test(fn.name?.text) && toString(fn.body).includes("__json_numeric_batch_"))new ObserveBatches().visit(fn.body);
      if(/^__json_numeric_batch_\\d+_original$/.test(fn.name?.text)) {
        const hit=SimpleParser.parseStatement("__rowBatchFallbackHit();");new BindRange().visit(hit);fn.body.statements.unshift(hit);
      }
    }
    const batchExports=[
      SimpleParser.parseTopLevelStatement("export function rowBatchCalls():i32 { return __rowBatchHits(); }"),
      SimpleParser.parseTopLevelStatement("export function rowBatchFallbackCalls():i32 { return __rowBatchFallbackHits(); }")
    ];
    new BindProbe().visit(batchExports);entry.statements.push(...batchExports);
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
    for (const runtime of [
      "incremental",
      "minimal",
      "stub",
      "count-gc",
      "batch-fallback",
    ]) {
      const instrumented =
        runtime === "count-gc" || runtime === "batch-fallback";
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
          env: {
            ...process.env,
            JSON_MODE: mode,
            JSON_CACHE: "0",
            PROBE_BATCH_FALLBACK:
              runtime === "batch-fallback" ? "true" : "false",
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
      if (instrumented) {
        assert.equal(g.rowBatchCapacity(0), 0n);
        assert.equal(g.rowBatchCapacity(0xffffffff), 0xffffffffn * 24n);
        checks += 2;
      }
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
        [17, 1],
        [33, 0],
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
        read(g.literalAlias()),
        '{"rows":[{"bs.offset = __dst;":7,"values":[1,2]}]}',
      );
      checks++;
      for (const count of [17, 33]) {
        const rows = Array.from({ length: count }, (_, index) =>
          index % 3 === 0
            ? "null"
            : '{"signed":-9223372036854775808,"wide":18446744073709551615,"enabled":true}',
        );
        assert.equal(
          read(g.constantRows(count)),
          '{"rows":[' + rows.join(",") + "]}",
        );
        checks++;
      }
      assert.equal(
        read(g.graphFallbacks()),
        '{"values":[{"items":[]}]}|{"values":[{"children":[]}]}',
      );
      checks += 8;
      if (instrumented) {
        assert.equal(g.rowBatchCalls() > 0, runtime !== "batch-fallback");
        assert.equal(
          g.rowBatchFallbackCalls() > 0,
          runtime === "batch-fallback",
        );
        checks += 2;
      }
    }
  }
  const runtimeImport = path
    .relative(dir, path.join(root, "assembly/index"))
    .split(path.sep)
    .join("/");
  const widthSource = path.join(dir, "batch-width.ts");
  const widthTransform = path.join(dir, "width-transform.mjs");
  fs.writeFileSync(
    widthTransform,
    `
    import Base from ${JSON.stringify(path.join(root, "transform/lib/index.js"))};
    export default class extends Base { afterParse(parser) {
      super.afterParse(parser);
      const source=parser.sources.find(s=>s.internalPath.endsWith("batch-width"));
      const selected=source.statements.some(n=>/^__json_numeric_batch_\\d+_capacity$/.test(n.name?.text));
      if(selected !== (process.env.PROBE_WIDTH_SHADOW !== "true")) throw Error("Wrong numeric-width binding selection");
    }}
  `,
  );
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const shadow of [false, true]) {
      fs.writeFileSync(
        widthSource,
        `
        import {JSON} from ${JSON.stringify(runtimeImport)};
        ${shadow ? "type u64=u8;" : ""}
        @json({nolazy}) class Row { value:i32=7; values:i32[]=[]; }
        @json({nolazy}) class Rows { rows:Row[]=[]; }
        export function model():i32 { return new Row().value; }
        export function run():string {
          const out=new Rows();
          for(let i=0;i<33;i++) {
            const row=new Row();
            for(let j=0;j<80;j++)row.values.push(i*80+j);
            out.rows.push(row);
          }
          return JSON.stringify(out);
        }
      `,
      );
      const output = path.join(dir, "batch-width.wasm");
      const compiled = spawnSync(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          widthSource,
          "--transform",
          widthTransform,
          "--runtime",
          "incremental",
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
            JSON_CACHE: "0",
            PROBE_WIDTH_SHADOW: String(shadow),
          },
        },
      );
      assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
      assert.doesNotMatch(
        compiled.stdout + compiled.stderr,
        /(?:WARNING|INFO) AS\d+/,
      );
      const instance = new WebAssembly.Instance(
        new WebAssembly.Module(fs.readFileSync(output)),
        {
          env: {
            abort() {
              throw Error("Numeric-width alias abort");
            },
          },
        },
      ).exports;
      // The shadowed case verifies compile-time fallback selection. The
      // unshadowed control additionally exercises complete serialized output.
      if (shadow) {
        assert.equal(instance.model(), 7);
        checks++;
        continue;
      }
      const pointer = instance.run();
      const text = Buffer.from(
        instance.memory.buffer,
        pointer,
        new DataView(instance.memory.buffer).getUint32(pointer - 4, true),
      ).toString("utf16le");
      assert.deepEqual(JSON.parse(text), {
        rows: Array.from({ length: 33 }, (_, i) => ({
          value: 7,
          values: Array.from({ length: 80 }, (_, j) => i * 80 + j),
        })),
      });
      checks++;
    }
  console.log(`Array row serialization: ${checks} checks passed`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
