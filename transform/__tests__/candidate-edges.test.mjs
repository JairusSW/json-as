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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-candidate-"));
const failures = [];
let checks = 0;
function decode(g, p) {
  return Buffer.from(
    g.memory.buffer,
    p,
    new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
  ).toString("utf16le");
}
function instance(file) {
  let g;
  g = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(file)), {
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
    assert.deepEqual(fn(), wanted);
  } catch (e) {
    failures.push(`${label}: ${e.message}`);
  }
}
try {
  for (const mode of process.env.PROBE_QUICK
    ? ["SWAR"]
    : ["NAIVE", "SWAR", "SIMD"])
    for (const strict of [false, true])
      for (const fast of process.env.PROBE_QUICK ? [true] : [false, true]) {
        const prefix = `${mode}/${strict}/${fast}`;
        for (const name of ["runtime", "date", "omission", "native-date"]) {
          const out = path.join(dir, `${name}.wasm`);
          try {
            execFileSync(
              process.execPath,
              [
                path.join(root, "node_modules/assemblyscript/bin/asc.js"),
                `assembly/__tests__/candidate-edges/${name}.fixture.ts`,
                "--transform",
                "./transform",
                "-O3",
                "--exportRuntime",
                "-o",
                out,
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
            const run = (fn) => {
              const g = instance(out);
              return fn(g);
            };
            if (name === "runtime") {
              for (const reuse of [false, true]) {
                check(
                  prefix + "/valid/" + reuse,
                  () => run((g) => g.valid(reuse)),
                  7,
                );
                if (strict)
                  for (const method of ["incompatible", "unknown"])
                    check(
                      prefix + "/" + method + "/" + reuse,
                      () =>
                        run((g) => {
                          assert.throws(() => g[method](reuse));
                          return true;
                        }),
                      true,
                    );
                check(
                  prefix + "/views/" + reuse,
                  () => run((g) => decode(g, g.views(reuse))),
                  '{"a":[1,2],"b":[3,4]}',
                );
                check(
                  prefix + "/reversed/" + reuse,
                  () => run((g) => decode(g, g.reversed(reuse))),
                  '{"view":[1,2,3,4],"bytes":[5,6,7,8]}',
                );
                check(
                  prefix + "/overlap/" + reuse,
                  () => run((g) => decode(g, g.overlap(reuse))),
                  '{"a":[1,2,3,4],"b":[5,6]}',
                );
                check(
                  prefix + "/buffer/" + reuse,
                  () => run((g) => decode(g, g.buffer(reuse))),
                  '{"bytes":[1,2],"view":[3,4]}',
                );
              }
              check(
                prefix + "/standalone",
                () => run((g) => g.standalone()),
                1,
              );
              check(
                prefix + "/lazy/ancestor",
                () => run((g) => JSON.parse(decode(g, g.ancestorOverride()))),
                { value: 7, text: "base" },
              );
              for (let k = 0; k < 6; k++)
                check(
                  prefix + "/numeric/" + k,
                  () => run((g) => g.numeric(k)),
                  1,
                );
              check(
                prefix + "/lazy/new",
                () => run((g) => decode(g, g.lazy(false))),
                '{"value":2,"text":"child","tail":3}',
              );
              check(
                prefix + "/lazy/parse",
                () => run((g) => decode(g, g.lazy(true))),
                '{"value":7,"text":"changed","tail":3}',
              );
              check(
                prefix + "/lazy/alias",
                () => run((g) => JSON.parse(decode(g, g.aliasOverride()))),
                { changed: 7, text: "base" },
              );
            } else if (name === "native-date")
              check(
                prefix + "/native-date",
                () => run((g) => decode(g, g.run())),
                "86400000:7",
              );
            else if (name === "date")
              for (const direct of [false, true])
                check(
                  prefix + "/date/" + direct,
                  () => run((g) => g.run(direct)),
                  7,
                );
            else {
              check(
                prefix + "/omission/arrows",
                () => run((g) => decode(g, g.arrows())),
                '{"tail":9}',
              );
              check(
                prefix + "/omission",
                () => run((g) => decode(g, g.run())),
                '{"tail":9}',
              );
            }
          } catch (e) {
            failures.push(
              prefix +
                "/" +
                name +
                " compile: " +
                (e.stderr?.toString() || e.message),
            );
          }
        }
      }
  // Exercise the real module cache: all three compiler invocations share one process.
  const asc = await import("assemblyscript/asc");
  const saved = process.env.JSON_MODE;
  delete process.env.JSON_MODE;
  try {
    for (const simd of [false, true, false]) {
      const out = path.join(dir, "mode.wasm");
      const { error, stderr } = await asc.main(
        [
          "assembly/__tests__/candidate-edges/date.fixture.ts",
          "--transform",
          "./transform",
          "-o",
          out,
          ...(simd ? ["--enable", "simd"] : []),
        ],
        { stdout: asc.createMemoryStream(), stderr: asc.createMemoryStream() },
      );
      check(
        `same-process/simd=${simd}`,
        () => {
          assert.ifError(error && Error(stderr.toString()));
          return true;
        },
        true,
      );
    }
  } finally {
    if (saved === undefined) delete process.env.JSON_MODE;
    else process.env.JSON_MODE = saved;
  }
  assert.deepEqual(failures, []);
  console.log(`Candidate edges: ${checks} checks passed`);
} finally {
  if (failures.length) console.error(failures.join("\n"));
  fs.rmSync(dir, { recursive: true, force: true });
}
