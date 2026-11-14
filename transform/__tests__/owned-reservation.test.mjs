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

const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(
  path.join(os.tmpdir(), "json-as-owned-reservation-"),
);
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of ["incremental", "minimal", "stub"]) {
      const file = path.join(dir, "probe.wasm");
      execFileSync(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          "assembly/__tests__/owned-reservation.fixture.ts",
          "--transform",
          "./transform",
          "--use",
          "ASC_RTRACE=1",
          "--exportRuntime",
          "--runtime",
          runtime,
          "-O3",
          "-o",
          file,
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ],
        { cwd: root, env: { ...process.env, JSON_MODE: mode }, stdio: "pipe" },
      );
      const module = new WebAssembly.Module(fs.readFileSync(file));
      let g;
      let large = 0;
      const rtrace = Object.fromEntries(
        WebAssembly.Module.imports(module)
          .filter((entry) => entry.module === "rtrace")
          .map(({ name }) => [
            name,
            (...args) => {
              if (
                g &&
                name === "onalloc" &&
                (new DataView(g.memory.buffer).getUint32(args[0], true) & ~3) >
                  65536
              )
                large++;
              return name === "onvisit" ? 1 : args[0] || 0;
            },
          ]),
      );
      g = new WebAssembly.Instance(module, {
        env: {
          abort() {
            throw Error("abort");
          },
        },
        rtrace,
      }).exports;
      g.setup();
      const expected = JSON.stringify(
        Array.from({ length: 3000 }, () => ({ a: 1, b: 2, c: 3 })),
      );
      const decode = (p) =>
        Buffer.from(
          g.memory.buffer,
          p,
          new DataView(g.memory.buffer).getUint32(p - 4, true),
        ).toString("utf16le");
      const retained = g.__pin(g.serialize());
      for (let i = 0; i < 3; i++) {
        large = 0;
        const out = g.serialize();
        assert.equal(decode(out), expected);
        if (runtime !== "stub")
          assert.equal(
            large,
            1,
            `${mode}/${runtime}: repeated large output allocations`,
          );
        g.__collect();
        assert.equal(decode(retained), expected);
      }
      for (const count of [1, 5000, 0, 3000]) {
        g.resize(count);
        assert.deepEqual(
          JSON.parse(decode(g.serialize())),
          Array.from({ length: count }, () => ({ a: 1, b: 2, c: 3 })),
        );
        g.__collect();
        assert.equal(decode(retained), expected);
      }
      g.__unpin(retained);
      g.setupStrings();
      const textExpected = JSON.stringify(
        Array.from({ length: 400 }, () => ({
          a: 1,
          b: 2,
          c: 3,
          text: "x".repeat(384),
        })),
      );
      const textRetained = g.__pin(g.serializeStrings());
      for (let i = 0; i < 3; i++) {
        large = 0;
        assert.equal(decode(g.serializeStrings()), textExpected);
        if (runtime !== "stub")
          assert.equal(
            large,
            1,
            `${mode}/${runtime}: learned reservation demand`,
          );
        g.__collect();
        assert.equal(decode(textRetained), textExpected);
      }
      g.__unpin(textRetained);
    }
  console.log(
    "Owned reservation: six allocation checks and retained output across nine configurations",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
