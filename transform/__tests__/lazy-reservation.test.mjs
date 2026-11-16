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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-lazy-reservation-"));
let checks = 0;
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of ["incremental", "minimal", "stub"])
      for (const strict of [false, true]) {
        const file = path.join(dir, "test.wasm");
        const build = spawnSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            "assembly/__tests__/lazy-reservation.fixture.ts",
            "--transform",
            "./transform",
            "--runtime",
            runtime,
            "-O3",
            "-o",
            file,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ],
          {
            cwd: root,
            encoding: "utf8",
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: String(strict),
              JSON_STRATEGIC_LAZINESS: "false",
              JSON_ACCESS_SPECIALIZATION: "false",
              JSON_CACHE: "0",
            },
          },
        );
        assert.equal(build.status, 0, build.stdout + build.stderr);
        assert.doesNotMatch(
          build.stdout + build.stderr,
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
          new WebAssembly.Module(fs.readFileSync(file)),
          {
            env: {
              abort(message) {
                throw Error(message ? read(message) : "abort");
              },
            },
          },
        ).exports;
        for (const materialized of [false, true])
          for (const [length, append, held] of [
            [0, false, false],
            [65536, true, false],
            [65536, true, true],
            [3, false, false],
          ]) {
            const text = read(
              g.render(
                length,
                Number(materialized),
                Number(append),
                Number(held),
              ),
            );
            const expected = {
              first: "x".repeat(length),
              scalar: 7,
              wide: 8,
              nullable: null,
              flag: true,
              ratio: 1.5,
              missing: null,
              rows: Array.from({ length: 64 }, (_, n) => ({ n })),
              future: [42, 43],
            };
            assert.equal(
              text,
              JSON.stringify(expected) + (append ? " ".repeat(1 << 19) : ""),
            );
            checks++;
          }
        for (const count of [0, 1, 2, 3, 15, 16, 17, 31, 32, 33, 3000])
          for (const credit of [0, 65536])
            for (const nullable of [false, true]) {
              const unused = g.rowBudget(count, credit, Number(nullable));
              const context = `${mode}/${runtime}/${strict}/${count}/${credit}/${nullable}`;
              if (runtime === "incremental" || count === 0)
                assert.equal(unused, credit, context);
              else assert.ok(unused > credit, context);
              checks++;
            }
      }
  console.log(
    `Lazy reservation: ${checks} deferred/materialized/default/capacity checks passed`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
