// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");
const source = fs.readFileSync(
  path.join(root, "bench/throughput/object-workload.ts"),
  "utf8",
);
const sizesJS = ts.transpileModule(
  fs.readFileSync(path.join(root, "bench/throughput/payload-sizes.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText;
const sizesURL =
  "data:text/javascript;base64," + Buffer.from(sizesJS).toString("base64");
const js = ts
  .transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  })
  .outputText.replaceAll("./payload-sizes", sizesURL);
const { RECORD_JSON, OBJECT_SIZES, OBJECT_LABELS, makeObjectJson } =
  await import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );

test("ten object samples grow one document from the same 1 KiB row", () => {
  assert.equal(Buffer.byteLength(RECORD_JSON), 1024);
  assert.equal(OBJECT_SIZES.length, 10);
  assert.equal(OBJECT_SIZES[0], 104858);
  assert.equal(OBJECT_SIZES.at(-1), 8 * 1024 * 1024);
  assert.equal(OBJECT_LABELS.length, OBJECT_SIZES.length);
  let previous = 0;
  for (const target of OBJECT_SIZES) {
    const text = makeObjectJson(target);
    const value = JSON.parse(text);
    const bytes = Buffer.byteLength(text);
    assert.deepEqual(Object.keys(value), ["records"]);
    assert(bytes >= target);
    assert(bytes < target + 1025);
    assert(bytes > previous);
    assert(value.records.length > 0);
    assert(value.records.every((row) => JSON.stringify(row) === RECORD_JSON));
    previous = bytes;
  }
});

test(
  "AssemblyScript and JS use identical growing-object inputs and models",
  { timeout: 120000 },
  () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "json-as-object-workload-"),
    );
    try {
      for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
        const file = path.join(dir, mode + ".wasm");
        execFileSync(
          process.execPath,
          [
            path.join(root, "node_modules/assemblyscript/bin/asc.js"),
            "assembly/__benches__/throughput/object-workload.fixture.ts",
            "--transform",
            "./transform",
            "-O3",
            "-o",
            file,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ],
          {
            cwd: root,
            env: { ...process.env, JSON_MODE: mode, JSON_STRICT: "false" },
            stdio: "pipe",
          },
        );
        const instance = new WebAssembly.Instance(
          new WebAssembly.Module(fs.readFileSync(file)),
          {
            env: {
              abort() {
                throw Error("Growing-object fixture aborted");
              },
            },
          },
        );
        for (const target of [1024, 900 * 1024, 1024 * 1024, 8 * 1024 * 1024]) {
          assert.equal(instance.exports.verifyString(target), target);
          assert.equal(
            instance.exports.verify(target),
            JSON.parse(makeObjectJson(target)).records.length,
          );
        }
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

test("strings share ten exact encoded document sizes across implementations", async () => {
  const text = fs.readFileSync(
    path.join(root, "bench/throughput/string-workload.ts"),
    "utf8",
  );
  const js = ts
    .transpileModule(text, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    })
    .outputText.replaceAll("./payload-sizes", sizesURL);
  const { makeString, PAYLOAD_SIZES } = await import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );
  for (const size of PAYLOAD_SIZES) {
    const value = makeString(size);
    assert.equal(Buffer.byteLength(JSON.stringify(value)), size);
    assert.equal(JSON.parse(JSON.stringify(value)), value);
  }
  const builders = fs.readFileSync(
    path.join(root, "scripts/build-charts.sh"),
    "utf8",
  );
  assert.doesNotMatch(
    builders,
    /build-(?:object|string)-(?:serialize|deserialize)-1mb/,
  );
});
