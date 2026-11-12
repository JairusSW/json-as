// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// Run with node --no-liftoff bench/strict-fallback/run.mjs BEFORE.wasm AFTER.wasm.
// Compile both revisions with JSON_STRICT=true and the same JSON_MODE, -O3,
// --runtime incremental --exportRuntime --exportStart start --enable simd.
import fs from "node:fs";
import assert from "node:assert/strict";

async function load(file) {
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(file), {
    env: {
      abort() {
        throw new Error("Wasm abort");
      },
    },
  });
  const e = instance.exports;
  e.start();
  return e;
}
function setup(e, text) {
  const ptr = e.__new(text.length * 2, 2);
  const view = new Uint16Array(e.memory.buffer, ptr, text.length);
  for (let i = 0; i < text.length; i++) view[i] = text.charCodeAt(i);
  e.setup(ptr);
}
const median = (a) => [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)];
const [before, after] = await Promise.all(process.argv.slice(2, 4).map(load));
if (!before || !after) throw new Error("Expected BEFORE.wasm and AFTER.wasm");
for (const count of [16, 8192]) {
  for (const pretty of [false, true]) {
    const record = {
      name: 'line\nquote"\\' + "x".repeat(256),
      values: Array.from({ length: count }, (_, i) => i + 0.25),
    };
    const text = JSON.stringify(record, null, pretty ? 2 : 0);
    setup(before, text);
    setup(after, text);
    const iterations = count === 16 ? 10000 : 200;
    for (const method of ["reuse", "custom"]) {
      const expected = iterations * (count + record.name.length + 0.25);
      const timings = [[], []];
      for (let sample = -2; sample < 9; sample++) {
        for (const index of sample % 2 ? [1, 0] : [0, 1]) {
          const e = index ? after : before;
          e.__collect();
          const start = process.hrtime.bigint();
          const result = e[method](iterations);
          const elapsed = Number(process.hrtime.bigint() - start) / iterations;
          assert.equal(result, expected);
          if (sample >= 0) timings[index].push(elapsed);
        }
      }
      const baseline = median(timings[0]);
      const candidate = median(timings[1]);
      console.log(
        JSON.stringify({
          count,
          pretty,
          method,
          utf16Bytes: text.length * 2,
          iterations,
          beforeNs: baseline,
          afterNs: candidate,
          timeDeltaPercent: 100 * (candidate / baseline - 1),
          samples: timings,
        }),
      );
    }
  }
}
