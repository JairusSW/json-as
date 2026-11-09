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
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-fresh-"));
let checks = 0;
try {
  for (const runtime of ["incremental", "minimal", "stub"]) {
    for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
      console.log(`Fresh construction: ${runtime}/${mode}`);
      const output = path.join(directory, `${runtime}-${mode}.wasm`);
      execFileSync(
        process.execPath,
        [
          path.join(root, "node_modules/assemblyscript/bin/asc.js"),
          "assembly/__tests__/fresh-construction.fixture.ts",
          "--transform",
          "./transform",
          "--runtime",
          runtime,
          "--exportRuntime",
          "-O3",
          "--debug",
          "-o",
          output,
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            JSON_MODE: mode,
            JSON_STRICT: "true",
            JSON_AS_LIBRARY_SOURCE: "assembly/index",
          },
          stdio: "pipe",
        },
      );
      const { instance } = await WebAssembly.instantiate(
        fs.readFileSync(output),
        {
          env: {
            abort(_message, _file, line, column) {
              throw new Error(`${runtime}/${mode}: abort at ${line}:${column}`);
            },
          },
        },
      );
      const count = instance.exports.run();
      assert.ok(count > 800, `${runtime}/${mode} did not execute the fixture`);
      checks += count;
      // Minimal collection is valid only with the guest stack unwound. A
      // second run checks recycled allocations and independent default graphs.
      instance.exports.__collect();
      assert.equal(
        instance.exports.run(),
        count,
        `${runtime}/${mode} after collection`,
      );
      checks += count;
    }
  }
  console.log(
    `Fresh construction: ${checks} checks passed across nine runtime/mode configurations`,
  );
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
