// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const base = path.join(root, "build/simdjson-parity");
fs.mkdirSync(base, { recursive: true });

for (const runtime of ["incremental", "minimal", "stub"]) {
  for (const bytes of [0, 16 * 1024 * 1024]) {
    test(`${runtime}: allocator can use preallocated memory (${bytes} bytes)`, async () => {
      const dir = fs.mkdtempSync(path.join(base, "preallocation-test-"));
      const entry = path.join(dir, "fixture.ts");
      const output = path.join(dir, "fixture.wasm");
      const module = path
        .relative(dir, path.join(root, "assembly/__benches__/lib/bench"))
        .split(path.sep)
        .join("/");
      fs.writeFileSync(
        entry,
        `import { preallocateMemory } from ${JSON.stringify(module)};
let live: ArrayBuffer | null = null;
export function seed(): void { live = new ArrayBuffer(4096); }
export function prepare(): void { preallocateMemory(); }
export function allocate(): void {
  live = new ArrayBuffer(12 * 1024 * 1024);
  store<u8>(changetype<usize>(live), 123);
  store<u8>(changetype<usize>(live) + live!.byteLength - 1, 45);
}
export function check(): i32 {
  __collect();
  return load<u8>(changetype<usize>(live)) + load<u8>(changetype<usize>(live) + live!.byteLength - 1);
}
export function pages(): i32 { return memory.size(); }
`,
      );
      try {
        execFileSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            entry,
            "--transform",
            "./transform",
            "--runtime",
            runtime,
            "--enable",
            "simd",
            "--use",
            `BENCH_PREALLOC_BYTES=${bytes}`,
            "-O3",
            "--noAssert",
            "-o",
            output,
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              JSON_AS_LIBRARY_SOURCE: "assembly/index",
              JSON_MODE: "SIMD",
              JSON_STRICT: "true",
              JSON_CACHE: "0",
            },
            stdio: "pipe",
          },
        );
        const { instance } = await WebAssembly.instantiate(
          fs.readFileSync(output),
          {
            env: {
              abort() {
                throw new Error("Allocation fixture aborted");
              },
            },
          },
        );
        const { seed, prepare, allocate, check, pages } = instance.exports;
        seed();
        const initial = pages();
        prepare();
        const reserved = pages();
        prepare();
        assert.equal(pages(), reserved, "preallocation is idempotent");
        if (!bytes) {
          assert.equal(reserved, initial, "zero disables preallocation");
        } else {
          assert.ok(reserved * 65536 >= bytes);
          allocate();
          assert.equal(
            pages(),
            reserved,
            "the allocator must use reserved pages without another memory.grow",
          );
          assert.equal(check(), 168, "live allocations survive collection");
          prepare();
          assert.equal(pages(), reserved);
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }
}
