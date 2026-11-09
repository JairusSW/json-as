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
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-fresh-clear-"));
try {
  let checked = 0;
  for (const runtime of ["incremental", "minimal", "stub"])
    for (const mode of ["NAIVE", "SWAR", "SIMD"])
      for (const strict of ["false", "true"]) {
        const output = path.join(dir, "fixture.wasm");
        execFileSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            "assembly/__tests__/fresh-object-clear.fixture.ts",
            "--transform",
            "./transform",
            "--runtime",
            runtime,
            "--enable",
            "simd",
            "--exportStart",
            "start",
            "-O3",
            "-o",
            output,
          ],
          {
            stdio: "pipe",
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: strict,
              JSON_USE_FAST_PATH: "1",
              JSON_CACHE: "0",
            },
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
          fs.readFileSync(output),
          {
            env: {
              abort(m, f, l, c) {
                throw Error(
                  `${runtime}/${mode}/${strict}: ${lift(m)} at ${lift(f)}:${l}:${c}`,
                );
              },
            },
          },
        );
        memory = instance.exports.memory;
        instance.exports.start();
        assert.equal(instance.exports.verify(), 1);
        checked++;
      }
  const broken = path.join(dir, "no-clear.mjs");
  fs.writeFileSync(
    broken,
    `import Base from ${JSON.stringify(pathToFileURL(path.resolve("transform/lib/index.js")).href)};import {Node} from ${JSON.stringify(pathToFileURL(path.resolve("node_modules/assemblyscript/dist/assemblyscript.js")).href)};export default class extends Base {afterParse(parser){super.afterParse(parser);const runtime=parser.sources.find(s=>s.internalPath.endsWith('assembly/util/runtime'));const clear=runtime.statements.find(s=>s.name?.text==='clearAllocatedObject');clear.body=Node.createBlockStatement([],clear.range);}}`,
  );
  const brokenOutput = path.join(dir, "no-clear.wasm");
  execFileSync(
    process.execPath,
    [
      "node_modules/assemblyscript/bin/asc.js",
      "assembly/__tests__/fresh-object-clear.fixture.ts",
      "--transform",
      broken,
      "--runtime",
      "minimal",
      "--exportStart",
      "start",
      "-O3",
      "-o",
      brokenOutput,
    ],
    {
      stdio: "pipe",
      env: {
        ...process.env,
        JSON_MODE: "SWAR",
        JSON_STRICT: "false",
        JSON_USE_FAST_PATH: "1",
        JSON_CACHE: "0",
      },
    },
  );
  const { instance: control } = await WebAssembly.instantiate(
    fs.readFileSync(brokenOutput),
    {
      env: {
        abort() {
          throw Error("uncleared poisoned storage");
        },
      },
    },
  );
  control.exports.start();
  assert.throws(
    () => control.exports.verify(),
    /uncleared poisoned storage/,
    "negative control must detect removal of the minimal-runtime clear",
  );
  console.log(
    `Fresh-object clears: ${checked} runtime/backend/strict configurations passed, including poisoned minimal-runtime reuse and generated child defaults`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
