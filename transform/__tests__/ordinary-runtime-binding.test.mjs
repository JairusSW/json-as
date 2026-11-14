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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-ordinary-binding-"));
const generated = path.join(
  root,
  "assembly/__tests__/ordinary-runtime-binding.fixture.tmp.ts",
);
const namespaceGenerated = path.join(
  root,
  "assembly/__tests__/ordinary-namespace-import.fixture.tmp.ts",
);
try {
  for (const mode of ["SWAR", "SIMD"])
    for (const strict of ["false", "true"]) {
      const wasm = path.join(dir, "test.wasm");
      execFileSync(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          "assembly/__tests__/ordinary-runtime-binding.fixture.ts",
          "--transform",
          "./transform",
          "-O3",
          "-o",
          wasm,
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            JSON_MODE: mode,
            JSON_STRICT: strict,
            JSON_WRITE:
              "assembly/__tests__/ordinary-runtime-binding.fixture.ts",
          },
          stdio: "pipe",
        },
      );
      assert.match(
        fs.readFileSync(generated, "utf8"),
        /J\.parse<Outer, __JSON_OrdinaryPlan_\d+>/,
      );
      const { instance } = await WebAssembly.instantiate(
        fs.readFileSync(wasm),
        {
          env: {
            abort() {
              throw Error("abort");
            },
          },
        },
      );
      assert.equal(instance.exports.read(), 10, `${mode}/${strict}`);
    }
  {
    const wasm = path.join(dir, "namespace.wasm");
    execFileSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/ordinary-namespace-import.fixture.ts",
        "--transform",
        "./transform",
        "-O3",
        "-o",
        wasm,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          JSON_MODE: "SWAR",
          JSON_WRITE: "assembly/__tests__/ordinary-namespace-import.fixture.ts",
        },
        stdio: "pipe",
      },
    );
    assert.match(
      fs.readFileSync(namespaceGenerated, "utf8"),
      /Runtime\.JSON\.parse<Record, __JSON_OrdinaryPlan_\d+>/,
    );
    const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasm), {
      env: {
        abort() {
          throw Error("abort");
        },
      },
    });
    assert.equal(instance.exports.read(), 7);
  }
  console.log(
    "Ordinary specialization: runtime binding passed in four configurations and a namespace import",
  );
} finally {
  if (fs.existsSync(generated)) fs.unlinkSync(generated);
  if (fs.existsSync(namespaceGenerated)) fs.unlinkSync(namespaceGenerated);
  fs.rmSync(dir, { recursive: true, force: true });
}
