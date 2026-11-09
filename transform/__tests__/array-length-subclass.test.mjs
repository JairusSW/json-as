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
import { stripVTControlCharacters } from "node:util";

const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-array-length-"));
const quick = !!process.env.PROBE_QUICK;
let checks = 0,
  configurations = 0;
try {
  for (const runtime of quick
    ? ["incremental"]
    : ["incremental", "minimal", "stub"])
    for (const mode of quick ? ["SWAR"] : ["NAIVE", "SWAR", "SIMD"])
      for (const strict of quick ? [false] : [false, true])
        for (const fast of quick ? [true] : [false, true]) {
          const label = [
            runtime,
            mode,
            "strict=" + strict,
            "fast=" + fast,
          ].join("/");
          const file = path.join(dir, "fixture.wasm");
          try {
            const compiled = spawnSync(
              process.execPath,
              [
                "node_modules/assemblyscript/bin/asc.js",
                "assembly/__tests__/array-length-subclass.fixture.ts",
                "--transform",
                "./transform",
                "-O3",
                "--runtime",
                runtime,
                "--exportRuntime",
                "-o",
                file,
                ...(mode === "SIMD" ? ["--enable", "simd"] : []),
              ],
              {
                cwd: root,
                env: {
                  ...process.env,
                  JSON_MODE: mode,
                  JSON_STRICT: String(strict),
                  JSON_USE_FAST_PATH: fast ? "1" : "0",
                },
                encoding: "utf8",
              },
            );
            assert.equal(compiled.status, 0, compiled.stderr);
            assert.doesNotMatch(
              stripVTControlCharacters(compiled.stderr + compiled.stdout),
              /WARNING [A-Z]+[0-9]+/,
            );
            let g;
            const decode = (p) =>
              p
                ? Buffer.from(
                    g.memory.buffer,
                    p,
                    new DataView(g.memory.buffer).getUint32(p - 4, true) &
                      0x7fffffff,
                  ).toString("utf16le")
                : "";
            g = new WebAssembly.Instance(
              new WebAssembly.Module(fs.readFileSync(file)),
              {
                env: {
                  abort(m, _f, l, c) {
                    throw Error(
                      (decode(m) || "AssemblyScript abort") +
                        " at " +
                        l +
                        ":" +
                        c,
                    );
                  },
                },
              },
            ).exports;
            assert.equal(decode(g.run()), "[1,2,3]", label);
            assert.equal(decode(g.matrix()), "", label);
            checks += g.count() + 1;
            configurations++;
            console.log(label, "passed");
          } catch (error) {
            console.error(
              label,
              stripVTControlCharacters(
                error.stderr?.toString() || error.stack || String(error),
              ),
            );
            throw error;
          }
        }
  console.log(
    "Array-subclass native storage:",
    checks,
    "checks across",
    configurations,
    "configurations; fresh/reused/fields/growth/GC/control routes passed.",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
