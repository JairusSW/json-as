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
import ts from "typescript";

// Use the RFC matrix's exact decoded string literals, including its existing
// byte-encoding compatibility cases, rather than decoding external UTF-8 again.
const source = ts.createSourceFile(
  "matrix.ts",
  fs.readFileSync("assembly/__tests__/rfc-matrix/matrix.spec.ts", "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const inputs = new Set();
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    ["expectAcceptEveryCompatibleTarget", "expectRejectEveryTarget"].includes(
      node.expression.getText(source),
    ) &&
    ts.isStringLiteral(node.arguments[0])
  )
    inputs.add(node.arguments[0].text);
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(inputs.size >= 300);
for (const value of [
  '{"a":[1,true,null,"\\u0041"]}',
  '[{"x":-1.25e+2},"plain"]',
]) {
  inputs.add(value);
  for (let i = 0; i <= value.length; i++) {
    inputs.add(value.slice(0, i));
    for (const token of ["\u0001", ",", ":", "]", '"', "x"])
      inputs.add(value.slice(0, i) + token + value.slice(i));
  }
}
for (const depth of [255, 256, 257])
  inputs.add("[".repeat(depth) + "0" + "]".repeat(depth));
const dir = fs.mkdtempSync(
  path.join(os.tmpdir(), "json-as-fallback-validator-"),
);
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
    const output = path.join(dir, mode + ".wasm");
    execFileSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/strict/fallback-validator.fixture.ts",
        "--transform",
        "./transform",
        "-O3",
        "--enable",
        "simd",
        "--exportRuntime",
        "--exportStart",
        "start",
        "-o",
        output,
      ],
      {
        env: { ...process.env, JSON_MODE: mode, JSON_STRICT: "true" },
        stdio: "pipe",
      },
    );
    const { instance } = await WebAssembly.instantiate(
      fs.readFileSync(output),
      {
        env: {
          abort() {
            throw new Error("Wasm abort");
          },
        },
      },
    );
    const e = instance.exports;
    e.start();
    for (const text of inputs) {
      const ptr = e.__pin(e.__new(text.length * 2, 2));
      const view = new Uint16Array(e.memory.buffer, ptr, text.length);
      for (let i = 0; i < text.length; i++) view[i] = text.charCodeAt(i);
      assert.equal(
        e.cursor(ptr),
        e.legacy(ptr),
        `${mode}: ${JSON.stringify(text).slice(0, 200)}`,
      );
      e.__unpin(ptr);
    }
    console.log(
      `${mode}: ${inputs.size} RFC/mutation/depth validator comparisons passed`,
    );
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
