// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-float-capacity-"));
try {
  for (const runtime of ["incremental", "minimal", "stub"])
    for (const mode of ["NAIVE", "SWAR", "SIMD"])
      for (const strict of ["false", "true"])
        for (const fast of ["0", "1"]) {
          const transform = "./transform";
          const out = path.join(dir, "test.wasm");
          execFileSync(
            process.execPath,
            [
              "node_modules/assemblyscript/bin/asc.js",
              "assembly/__tests__/float-array-capacity.fixture.ts",
              "--transform",
              transform,
              "-O3",
              "--runtime",
              runtime,
              "--enable",
              "simd",
              "--maximumMemory",
              "64",
              "--exportStart",
              "start",
              "-o",
              out,
            ],
            {
              env: {
                ...process.env,
                JSON_MODE: mode,
                JSON_STRICT: strict,
                JSON_USE_FAST_PATH: fast,
                JSON_CACHE: "0",
              },
              stdio: "pipe",
            },
          );
          let memory;
          const lift = (p) =>
            p
              ? Buffer.from(
                  memory.buffer,
                  p,
                  new DataView(memory.buffer).getUint32(p - 4, true),
                ).toString("utf16le")
              : "";
          const { instance } = await WebAssembly.instantiate(
            fs.readFileSync(out),
            {
              env: {
                abort(m, f, l, c) {
                  throw Error(
                    `${runtime}/${mode}/${strict}/${fast}: ${lift(m)} at ${lift(f)}:${l}:${c}`,
                  );
                },
              },
            },
          );
          memory = instance.exports.memory;
          instance.exports.start();
          assert.equal(instance.exports.verify(), 26);
          console.log(
            runtime,
            mode,
            strict,
            transform,
            "float nested/root/shared/reused/subtype growth and retained GC passed",
          );
        }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
