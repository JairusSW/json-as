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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-prior-"));
const failures = [];
let checks = 0;
const tokens = ["[1,2]", '"hello"', "7", "true", '{"n":1}'];
const expected = tokens
  .concat(tokens)
  .map((token) => '{"value":' + token + ',"tail":9}')
  .concat([
    "[null,2]",
    "[null,2]",
    '{"a":{"x":1},"b":{"x":2}}',
    "1:1",
    "1:1",
    "1:1",
    "true",
    '{"value":7,"tail":9}',
    '{"value":0}',
    '{"value":0}',
    "99:1",
    "true",
  ]);
const bindings = {
  "namespace-private-inherited": '{"value":{"value":5},"tail":9}',
  "generic-private-inherited": '{"value":{"value":5},"tail":9}',
  "lazy-private-inherited": '{"value":{"value":5},"tail":9}',
  "namespace-base": '{"value":5,"tail":9}',
  "reexport-base": '{"value":5,"tail":9}',
  "private-array": '{"value":[{"value":9}]}',
  "private-enum": '{"value":1}',
  "private-inherited": '{"value":{"value":5},"tail":9}',
  "nullable-lazy": '{"value":null}',
  "generic-lazy": '{"value":7}',
  "required-raw": '{"raw":7,"values":{"x":1}}',
  "required-box": '{"raw":7,"values":{"x":1}}',
  "array-field": '{"value":[1,2]}',
  "map-field": '{"value":{"x":1}}',
  "set-field": '{"value":[1,2]}',
  "quoted-omit": '{"value":7,"label":"visible"}',
  "lazy-reexport": "0:1:7",
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
              `assembly/__tests__/prior-composition/${name}.fixture.ts`,
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
console.log(`Prior composition: ${checks} checks passed`);
