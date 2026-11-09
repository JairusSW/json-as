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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-api-"));
const failures = [];
let checks = 0;
const expected = [
  "99:1",
  "99:1",
  "99:1",
  "99:1",
  "99:1",
  "99:1",
  "86400000",
  "[1,2]",
  '{"value":null,"tail":9}',
  '{"value":null,"tail":9}',
  "[[1,2],[3]]",
  "[null,[1,2]]",
  "[[1,2],[3]]",
  '{"value":[[1,2],[3]]}',
  '{"n":2}',
  "[1,2]",
  "true",
  "true",
  "true",
  "true",
  "99:1",
  "99:1",
  "99:1",
  "true",
  "true",
  "true",
  "true",
];
const bindings = {
  "namespace-helpers": '{"value":8}',
  "renamed-package": '{"value":7}',
  "renamed-assembly": '{"value":7}',
  omission: '{"next":9}|{"next":9}',
  "parse-out": "[1,2]",
  "renamed-json": '{"value":7}',
  "collision-bs": '{"value":9}',
  "collision-atoi": '{"value":7}',
  "collision-src": '{"__src":"ordinary","value":7}',
  "collision-value": '{"__name_val":"ordinary","name":"default"}',
  "zero-omit": '{"value":7}',
  "qualified-self": "7",
  "alias-self": "7",
  "alias-return": "7",
  "alias-input": "7",
};
function decode(g, p) {
  return Buffer.from(
    g.memory.buffer,
    p,
    new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
  ).toString("utf16le");
}
function instantiate(module) {
  let g;
  g = new WebAssembly.Instance(module, {
    env: {
      abort(m, f, l, c) {
        throw Error(decode(g, m) + ` (${decode(g, f)}:${l}:${c})`);
      },
    },
  }).exports;
  return g;
}
function check(label, fn, wanted) {
  checks++;
  try {
    assert.equal(fn(), wanted);
  } catch (error) {
    failures.push(label + ": " + error.message);
  }
}
try {
  for (const mode of process.env.PROBE_QUICK
    ? ["SWAR"]
    : ["NAIVE", "SWAR", "SIMD"])
    for (const strict of process.env.PROBE_QUICK ? [false] : [false, true])
      for (const fast of process.env.PROBE_QUICK ? [true] : [false, true]) {
        const prefix = `${mode}/strict=${strict}/fast=${fast}`;
        const compile = (name) => {
          const output = path.join(dir, name + ".wasm");
          execFileSync(
            process.execPath,
            [
              path.join(root, "node_modules/assemblyscript/bin/asc.js"),
              `assembly/__tests__/api-composition/${name}.fixture.ts`,
              "--transform",
              "./transform",
              "--exportRuntime",
              "-O3",
              "-o",
              output,
              ...(mode === "SIMD" ? ["--enable", "simd"] : []),
            ],
            {
              cwd: root,
              env: {
                ...process.env,
                JSON_MODE: mode,
                JSON_STRICT: String(strict),
                JSON_USE_FAST_PATH: fast ? "1" : "0",
                JSON_AS_LIBRARY_SOURCE: "assembly/index",
              },
              stdio: "pipe",
            },
          );
          return new WebAssembly.Module(fs.readFileSync(output));
        };
        try {
          const module = compile("runtime");
          for (let kind = 0; kind < expected.length; kind++)
            for (const reuse of [false, true])
              check(
                prefix + "/runtime/" + kind + "/" + reuse,
                () => {
                  const g = instantiate(module);
                  return decode(g, g.run(kind, reuse));
                },
                expected[kind],
              );
        } catch (error) {
          failures.push(
            prefix +
              "/runtime compilation: " +
              (error.stderr?.toString() || error.message),
          );
        }
        // Signature and binding checks are transform-time operations. They need both
        // strict routes and all code generators, not every fast-path combination.
        if (
          !process.env.PROBE_RUNTIME_ONLY &&
          ((strict && !fast) || (!strict && fast) || process.env.PROBE_QUICK)
        )
          for (const [name, wanted] of Object.entries(bindings)) {
            try {
              const module = compile(name);
              check(
                prefix + "/" + name,
                () => {
                  const g = instantiate(module);
                  return decode(g, g.run());
                },
                wanted,
              );
            } catch (error) {
              failures.push(
                prefix +
                  "/" +
                  name +
                  " compilation: " +
                  (error.stderr?.toString() || error.message),
              );
            }
          }
        console.log(prefix + " checked");
      }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
assert.equal(failures.length, 0, failures.join("\n"));
console.log(`API composition: ${checks} checks passed`);
