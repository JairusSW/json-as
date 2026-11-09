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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-edges-"));
const failures = [];
let checks = 0;
const expected = [
  "1:1",
  "1",
  '{"value":7}',
  '{"__value_lz":5,"value":7}',
  "true:1",
  "true:1",
  "true:1",
  "true",
  "true",
  '"custom"',
];
const bindings = {
  namespace: '{"value":5,"tail":9}:1:0:1',
  "root-import": '{"value":7}:{"value":7}',
  "default-inherit": '{"value":7,"tail":9}',
  "default-local": '{"value":7,"tail":9}',
  "private-array": '{"value":[{"value":9}]}',
  "private-generic": '{"value":{"value":9}}',
  "private-enum": '{"value":1}',
  "backing-string": '{"__name_val":"base","name":"child"}',
  "helper-omit": '{"value":7}',
  "helper-init": '{"child":{"value":3},"other":3}',
  stamp: '"1970-01-02T00:00:00.000Z"',
  raw: "[1,2]",
  box: "7",
  self: "7",
};
function decode(g, p) {
  if (!p) return "<unknown>";
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
    ? ["NAIVE"]
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
              `assembly/__tests__/release-edges/${name}.fixture.ts`,
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
          const module = process.env.PROBE_BINDING ? null : compile("runtime");
          for (let kind = 0; kind < (module ? expected.length : 0); kind++)
            for (const reuse of [false])
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
          for (const [name, wanted] of Object.entries(bindings).filter(
            ([name]) =>
              !process.env.PROBE_BINDING || name === process.env.PROBE_BINDING,
          )) {
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
console.log(`Release edges: ${checks} checks passed`);
