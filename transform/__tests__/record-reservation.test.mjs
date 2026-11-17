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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-record-budget-"));
let checks = 0;
// Observe completed reservations after the transform's stock-runtime check.
// Instrumentation must not disable the very optimization being tested.
fs.writeFileSync(
  path.join(dir, "observe.mjs"),
  `import Base from ${JSON.stringify(path.join(root, "transform/lib/index.js"))};
import {SimpleParser} from ${JSON.stringify(path.join(root, "transform/lib/util.js"))};
import {Visitor} from ${JSON.stringify(path.join(root, "transform/lib/visitor.js"))};
export default class extends Base {
  afterParse(parser) {
    super.afterParse(parser);
    const source = parser.sources.find(s => s.internalPath.endsWith("lib/as-bs"));
    const bs = source.statements.find(n => n.name?.text === "bs");
    const finish = bs.members.find(n => n.name?.text === "updateOwnedHint");
    const nodes = [
      SimpleParser.parseTopLevelStatement("let observedReservation: usize = 0;"),
      SimpleParser.parseTopLevelStatement("let observedLength: usize = 0;"),
      SimpleParser.parseTopLevelStatement("export function recordDiagnosticReservation(): usize { return observedReservation; }"),
      SimpleParser.parseTopLevelStatement("export function recordDiagnosticLength(): usize { return observedLength; }")
    ];
    const statements = [
      SimpleParser.parseStatement("observedReservation = reserved;"),
      SimpleParser.parseStatement("observedLength = len;")
    ];
    class Bind extends Visitor { _visit(node, parent) { node.range = bs.range; super._visit(node, parent); } }
    new Bind().visit([...nodes, ...statements]);
    bs.members.push(...nodes);
    finish.body.statements.unshift(...statements);
  }
}`,
);
try {
  for (const mode of process.env.PROBE_QUICK
    ? ["SIMD"]
    : ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of process.env.PROBE_QUICK
      ? ["incremental"]
      : ["incremental", "minimal", "stub"]) {
      const file = path.join(dir, "probe.wasm");
      const compiled = spawnSync(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          "assembly/__tests__/record-reservation.fixture.ts",
          "--transform",
          path.join(dir, "observe.mjs"),
          "--runtime",
          runtime,
          "--exportRuntime",
          "-O3",
          "-o",
          file,
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ],
        {
          cwd: root,
          env: { ...process.env, JSON_MODE: mode, JSON_CACHE: "0" },
          encoding: "utf8",
        },
      );
      assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
      assert.doesNotMatch(
        compiled.stdout + compiled.stderr,
        /(?:WARNING|INFO) AS\d+/,
      );
      const g = new WebAssembly.Instance(
        new WebAssembly.Module(fs.readFileSync(file)),
        {
          env: {
            abort(message, file, line, column) {
              const read = (p) =>
                Buffer.from(
                  g.memory.buffer,
                  p,
                  new DataView(g.memory.buffer).getUint32(p - 4, true) &
                    0x7fffffff,
                ).toString("utf16le");
              throw Error(
                `${read(message)} at ${read(file)}:${line}:${column}`,
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
      const expected = (count) => ({
        rows: Array.from({ length: count }, () => ({
          value: 7,
          text: "x".repeat(384),
        })),
        tail: 9,
      });
      g.resize(1000);
      const original = JSON.stringify(expected(1000));
      const retained = g.__pin(g.write());
      assert.equal(decode(retained), original);
      checks++;
      for (const count of [1000, 1, 2000, 0, 1000]) {
        g.resize(count);
        assert.equal(decode(g.write()), JSON.stringify(expected(count)));
        const length = g.recordLength();
        const reserved = g.recordReservation();
        assert.ok(
          reserved >= length,
          `${mode}/${runtime}: caller reservation underflow`,
        );
        if (runtime === "incremental")
          assert.ok(
            reserved - length <= 32,
            `${mode}: accumulated numeric estimates: ${reserved - length}`,
          );
        g.__collect();
        assert.equal(decode(retained), original);
        checks += 3;
      }
      g.change();
      const changed = expected(1000);
      changed.rows[0] = { value: 17, text: 'changed\n"' };
      assert.equal(decode(g.write()), JSON.stringify(changed));
      g.__collect();
      assert.equal(decode(retained), original);
      g.__unpin(retained);
      checks += 2;
    }
  console.log(
    `Record reservations: ${checks} output, capacity-transition, mutation and retained-GC checks passed`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
