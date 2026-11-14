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
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-gemini-boundary-"));
try {
  for (const mode of ["SWAR", "SIMD"]) {
    const output = path.join(dir, `${mode}.wasm`);
    execFileSync(
      process.execPath,
      [
        path.join(root, "node_modules/assemblyscript/bin/asc.js"),
        "assembly/__tests__/gemini-boundary.fixture.ts",
        "--transform",
        "./transform",
        "--runtime",
        "stub",
        "-O3",
        "--exportRuntime",
        ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        "-o",
        output,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          JSON_MODE: mode,
          JSON_DIAGNOSTICS: "true",
          JSON_STRICT: "false",
          JSON_AS_LIBRARY_SOURCE: "assembly/index",
        },
        stdio: "pipe",
      },
    );
    const module = new WebAssembly.Module(fs.readFileSync(output));
    for (let kind = 0; kind < 3; kind++) {
      const guest = new WebAssembly.Instance(module, {
        env: {
          abort() {
            throw new Error("abort");
          },
        },
      }).exports;
      assert.equal(
        guest.tables(),
        1,
        `${mode}: every power-of-ten table entry`,
      );
      assert.equal(guest.numbers(), 1, `${mode}: float and exponent decoding`);
      const pointer = guest.boundary(kind);
      const bytes = new DataView(guest.memory.buffer).getUint32(
        pointer - 4,
        true,
      );
      const result = Buffer.from(guest.memory.buffer, pointer, bytes).toString(
        "utf16le",
      );
      const input =
        "a".repeat(mode === "SIMD" ? 7 : 3) +
        ['"', "\u0001", "\ud800"][kind] +
        "a";
      assert.equal(
        result,
        JSON.stringify(input),
        `${mode}: escape ${kind} at physical memory end`,
      );
    }
  }
  console.log(
    "String physical-memory boundaries, power tables and scalar-number parser checks passed",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
