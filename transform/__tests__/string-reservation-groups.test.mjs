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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-string-groups-"));
let checks = 0;
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of ["incremental", "minimal", "stub"]) {
      const wasm = path.join(dir, "groups.wasm");
      execFileSync(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          "assembly/__tests__/string-reservation-groups.fixture.ts",
          "--transform",
          "./transform",
          "--exportRuntime",
          "--runtime",
          runtime,
          "-O3",
          "-o",
          wasm,
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ],
        { cwd: root, env: { ...process.env, JSON_MODE: mode }, stdio: "pipe" },
      );
      const g = new WebAssembly.Instance(
        new WebAssembly.Module(fs.readFileSync(wasm)),
        {
          env: {
            abort() {
              throw Error("abort");
            },
          },
        },
      ).exports;
      const decode = (ptr) =>
        Buffer.from(
          g.memory.buffer,
          ptr,
          new DataView(g.memory.buffer).getUint32(ptr - 4, true) & 0x7fffffff,
        ).toString("utf16le");
      const retained = [];
      for (const input of [
        "",
        "small",
        'a"b\\c',
        "é😀\ud800",
        "x".repeat(20000),
        "short",
        "\n".repeat(30000),
        "",
      ]) {
        const bytes = Buffer.from(input, "utf16le");
        const ptr = g.__pin(g.allocInput(bytes.length));
        new Uint8Array(g.memory.buffer, ptr, bytes.length).set(bytes);
        const out = g.__pin(g.run(ptr));
        g.__unpin(ptr);
        const expected = {
          beforeA: input,
          beforeB: input + "head",
          middle: 7,
          afterA: input,
          afterB: input + "end",
          nullable: input.length ? input : null,
        };
        retained.push({ out, expected });
        if (runtime !== "stub") g.__collect();
        for (const previous of retained) {
          assert.deepEqual(
            JSON.parse(decode(previous.out)),
            previous.expected,
            `${mode}/${runtime}`,
          );
          checks++;
        }
      }
      for (const { out } of retained) g.__unpin(out);
    }
  console.log(
    `String reservation groups: ${checks} callback-order/GC/retained-output checks across nine configurations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
