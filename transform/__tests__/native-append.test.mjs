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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-append-"));
try {
  let checks = 0;
  for (const runtime of ["incremental", "minimal", "stub"])
    for (const mode of ["NAIVE", "SWAR", "SIMD"])
      for (const strict of ["false", "true"]) {
        const output = path.join(dir, "append.wasm");
        execFileSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            "assembly/__tests__/native-append.fixture.ts",
            "--transform",
            "./transform",
            "-O3",
            "--runtime",
            runtime,
            "--enable",
            "simd",
            "--use",
            "ASC_RTRACE=1",
            "--exportStart",
            "start",
            "--exportRuntime",
            "-o",
            output,
          ],
          {
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: strict,
              JSON_USE_FAST_PATH: "1",
              JSON_CACHE: "0",
            },
            stdio: "pipe",
          },
        );
        let allocations = 0;
        const noop = () => {};
        const { instance } = await WebAssembly.instantiate(
          fs.readFileSync(output),
          {
            env: {
              abort(m, f, l, c) {
                throw Error(`${runtime}/${mode}/${strict}: ${l}:${c}`);
              },
            },
            rtrace: {
              oninit: noop,
              onalloc() {
                allocations++;
              },
              onresize: noop,
              onmove: noop,
              onfree: noop,
              onvisit() {
                return 1;
              },
              oncollect: noop,
              oninterrupt: noop,
              onyield: noop,
              onload(p) {
                return p;
              },
              onstore(p) {
                return p;
              },
            },
          },
        );
        const g = instance.exports;
        g.start();
        allocations = 0;
        assert.equal(g.noGrowth(), 1);
        assert.equal(
          allocations,
          0,
          "in-capacity append allocates no metadata or storage",
        );
        assert.equal(g.storage(), 1);
        assert.equal(g.managedStorage(), 1);
        assert.equal(g.parser(), 1);
        checks++;
      }
  console.log(
    `Native append: growth, sharing, GC, subtype storage and reuse passed (${checks} configurations)`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
