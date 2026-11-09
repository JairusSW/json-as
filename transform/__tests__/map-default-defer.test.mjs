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
import { pathToFileURL } from "node:url";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-map-defaults-"));
try {
  const url = (p) => pathToFileURL(path.resolve(p)).href;
  const control = path.join(dir, "control.mjs");
  fs.writeFileSync(
    control,
    `import Transformer from ${JSON.stringify(url("transform/lib/index.js"))};
    import {Visitor} from ${JSON.stringify(url("transform/lib/visitor.js"))};
    export default class extends Transformer {afterParse(parser){super.afterParse(parser);
      class Remove extends Visitor {visitClassDeclaration(n,p){n.members=n.members.filter(m=>m.name.text!=='__DESERIALIZE_DEFER_DEFAULTS');super.visitClassDeclaration(n,p);}}
      for(const source of parser.sources)new Remove().visit(source);
    }}`,
  );
  let checked = 0;
  for (const runtime of ["incremental", "minimal", "stub"])
    for (const mode of ["NAIVE", "SWAR", "SIMD"])
      for (const strict of ["false", "true"]) {
        const counts = {};
        for (const [name, transform] of [
          ["control", control],
          ["deferred", "./transform"],
        ]) {
          const output = path.join(dir, "map.wasm");
          execFileSync(
            process.execPath,
            [
              "node_modules/assemblyscript/bin/asc.js",
              "assembly/__tests__/map-default-defer.fixture.ts",
              "--transform",
              transform,
              "-O3",
              "--runtime",
              runtime,
              "--enable",
              "simd",
              "--use",
              "ASC_RTRACE=1",
              "--exportStart",
              "start",
              "--exportRuntime",
              "-o",
              output,
            ],
            {
              env: {
                ...process.env,
                JSON_MODE: mode,
                JSON_STRICT: strict,
                JSON_USE_FAST_PATH: "1",
                JSON_CACHE: "0",
              },
              stdio: "pipe",
            },
          );
          let allocations = 0;
          const noop = () => {};
          const { instance } = await WebAssembly.instantiate(
            fs.readFileSync(output),
            {
              env: {
                abort(m, f, l, c) {
                  throw Error(
                    `${name}/${runtime}/${mode}/${strict}: ${l}:${c}`,
                  );
                },
              },
              rtrace: {
                oninit: noop,
                onalloc() {
                  allocations++;
                },
                onresize: noop,
                onmove: noop,
                onfree: noop,
                onvisit() {
                  return 1;
                },
                oncollect: noop,
                oninterrupt: noop,
                onyield: noop,
                onload(p) {
                  return p;
                },
                onstore(p) {
                  return p;
                },
              },
            },
          );
          instance.exports.start();
          allocations = 0;
          assert.equal(instance.exports.allocationCase(), 1);
          counts[name] = allocations;
          assert.equal(instance.exports.verify(), 1);
        }
        // The stub runtime does not emit RTrace allocation events.
        if (runtime !== "stub")
          assert.ok(
            counts.deferred < counts.control,
            `${runtime}/${mode}/${strict}: fresh Map defaults must avoid allocations: ${JSON.stringify(counts)}`,
          );
        checked++;
      }
  console.log(
    `Map default deferral: defaults, reuse, fallback, effects, sharing, inheritance and GC passed in ${checked} configurations; fewer allocations verified for incremental/minimal`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
