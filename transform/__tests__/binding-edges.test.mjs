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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-binding-"));
const failures = [];
let checks = 0;
const expected = [
  JSON.stringify({ value: 1.5 }),
  "1.5",
  '{"base":1,"middle":2,"leaf":3}',
  '{"base":7,"middle":8,"leaf":9}',
  '{"leaf":3}',
  '{"leaf":3}',
  "1:1",
  "[[1],[2],[3]]",
  "[[1],[2]]",
  "86400000",
  "[7,8]:0",
  "[7,8]:0",
];
const bindings = {
  "generic-argument": JSON.stringify({ value: 1.5 }),
  ancestor: '{"wire":"updated","middle":8,"leaf":9}',
  "argument-parse": '{"value":2.5}',
  scalar: '{"value":1.5,"tail":9}:{"value":1.5,"tail":9}',
  chain: '{"root":1,"middle":2,"leaf":3}',
  lazy: '{"date":"1970-01-01T00:00:00.000Z","raw":7,"box":7,"bytes":[1,2],"arbitrary":7}',
  forward: "7",
  nested: "7",
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
              `assembly/__tests__/binding-edges/${name}.fixture.ts`,
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
console.log(`Binding edges: ${checks} checks passed`);
