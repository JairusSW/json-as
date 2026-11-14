// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-map-key-"));
try {
  const control = path.join(dir, "control.mjs");
  const moduleUrl = (p) => pathToFileURL(path.resolve(p)).href;
  fs.writeFileSync(
    control,
    `import Transformer from ${JSON.stringify(moduleUrl("transform/lib/index.js"))};import{Visitor}from ${JSON.stringify(moduleUrl("transform/lib/visitor.js"))};
 export default class extends Transformer{afterParse(parser){super.afterParse(parser);let changed=0;const source=parser.sources.find(s=>s.internalPath.endsWith('assembly/deserialize/naive/map'));
 class Calls extends Visitor{visitCallExpression(n,p){if(n.expression.text==='allocateObject'){n.expression.text='__new';changed++;}super.visitCallExpression(n,p);}}
 class Functions extends Visitor{visitFunctionDeclaration(n,p){if(n.name.text==='deserializeFreshStringMapKey')new Calls().visit(n.body);super.visitFunctionDeclaration(n,p);}}
 new Functions().visit(source);if(changed!==1)throw Error('Missing fresh key allocation');}}
 `,
  );
  for (const [runtime, strict, transform] of [
    ["incremental", "false"],
    ["incremental", "true"],
    ["minimal", "false"],
    ["stub", "false"],
  ].flatMap(([r, s]) => [control, "./transform"].map((t) => [r, s, t]))) {
    const output = path.join(dir, "key.wasm");
    execFileSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/map-key-allocation.fixture.ts",
        "--transform",
        transform,
        "-O3",
        "--runtime",
        runtime,
        "--enable",
        "simd",
        "--maximumMemory",
        "64",
        "--use",
        `JSON_KEY_GC_STRESS=${runtime === "incremental" ? 1 : 0}`,
        "--exportStart",
        "start",
        "-o",
        output,
      ],
      {
        env: {
          ...process.env,
          JSON_MODE: "SIMD",
          JSON_STRICT: strict,
          JSON_USE_FAST_PATH: "1",
          JSON_CACHE: "0",
        },
        stdio: "pipe",
      },
    );
    const { instance } = await WebAssembly.instantiate(
      fs.readFileSync(output),
      {
        env: {
          abort(m, f, l, c) {
            throw Error(`${runtime}/${strict}: ${l}:${c}`);
          },
        },
      },
    );
    instance.exports.start();
    assert.equal(instance.exports.verify(), 103);
    console.log(
      runtime,
      strict,
      transform,
      "retained keys and collection in decoders passed",
    );
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
