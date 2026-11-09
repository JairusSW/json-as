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
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-publication-"));
const url = (file) => pathToFileURL(path.resolve(file)).href;
const wrapper = path.join(dir, "observe.mjs");
fs.writeFileSync(wrapper, `
import Base from ${JSON.stringify(url(process.env.JSON_TEST_TRANSFORM ?? "transform/lib/index.js"))};
import {Visitor} from ${JSON.stringify(url("transform/lib/visitor.js"))};
import {SimpleParser,toString} from ${JSON.stringify(url("transform/lib/util.js"))};
export default class extends Base {
 afterParse(parser) {
  super.afterParse(parser);
  class Observe extends Visitor {
   visitMethodDeclaration(n,p) {
    const previous=this.active;
    this.active=['__DESERIALIZE_FAST','__DESERIALIZE_WHITESPACE'].includes(n.name.text);
    super.visitMethodDeclaration(n,p);this.active=previous;
   }
   visitCallExpression(n,p) {
    if(this.active) {
     const name=toString(n.expression);
     let replacement;
     if(name==='load'&&n.typeArguments?.length===1&&toString(n.typeArguments[0])==='usize'&&n.args.length===2&&toString(n.args[1]).includes('"values"')) {
      replacement='readArrayField';n.typeArguments=null;
     } else if(name.endsWith('.__linkObject')) replacement='recordPublication';
     if(replacement) {
      const id=SimpleParser.parseExpression(replacement);id.range=n.range;n.expression=id;
     }
    }
    super.visitCallExpression(n,p);
   }
  }
  for(const s of parser.sources)
   if(s.internalPath.endsWith('array-publication.fixture'))new Observe().visit(s);
 }
}
`);
const configs = ["incremental", "minimal", "stub"].flatMap((runtime) =>
  ["NAIVE", "SWAR", "SIMD"].flatMap((mode) =>
    ["false", "true"].flatMap((strict) =>
      ["0", "1"].map((fast) => ({ runtime, mode, strict, fast, trace: false, profile: false })),
    ),
  ),
);
configs.push({ runtime: "incremental", mode: "SWAR", strict: "false", fast: "1", trace: true, profile: false });
configs.push({ runtime: "incremental", mode: "SWAR", strict: "false", fast: "1", trace: false, profile: true });
try {
  for (const c of configs) {
    const file = path.join(dir, "fixture.wasm");
    execFileSync(process.execPath, [
      "node_modules/assemblyscript/bin/asc.js", "transform/__tests__/array-publication.fixture.ts",
      "--transform", wrapper, "-O3", "--runtime", c.runtime, "--enable", "simd",
      "--exportStart", "start", "--exportRuntime", "-o", file,
      ...(c.trace ? ["--use", "ASC_RTRACE=1"] : []),
      ...(c.profile ? ["--use", "ASC_PROFILE=1"] : []),
    ], { env: { ...process.env, JSON_MODE: c.mode, JSON_STRICT: c.strict,
      JSON_USE_FAST_PATH: c.fast, JSON_CACHE: "0" }, stdio: "pipe" });
    const hooks = {};
    for (const name of ["oninit", "onalloc", "onresize", "onmove", "onfree", "onvisit",
      "oncollect", "oninterrupt", "onyield", "onload", "onstore"])
      hooks[name] = (...args) => name === "onvisit" ? 1 : args[0];
    let guest, tracked = 0, offset = 0, publications = 0;
    const { instance } = await WebAssembly.instantiate(fs.readFileSync(file), {
      rtrace: hooks, env: {
        abort(_m, _f, line, column) { throw Error(`${JSON.stringify(c)}: abort ${line}:${column}`); },
        trace(_message, count, parent, child) {
          if (count === 2 && parent === tracked) {
            assert.equal(child, new DataView(guest.memory.buffer).getUint32(tracked + offset, true),
              "Publication must use the field's actual current reference");
            publications++;
          }
        },
      },
    });
    guest = instance.exports;
    guest.start();
    for (const spaced of [false, true]) for (let kind = 0; kind < 5; kind++) {
      tracked = guest.prepare(kind); offset = guest.fieldOffset(kind); publications = 0;
      assert.equal(guest.exercise(kind, spaced), 1);
      const expected = c.fast === "0" ? 0 : kind === 0 && !c.trace && !c.profile ? 1 : kind === 2 ? 0 : kind === 3 ? 1 : 2;
      assert.equal(guest.reads(), expected, `${JSON.stringify(c)} case ${kind}`);
      if (kind === 4 && c.fast === "1") assert.equal(guest.mutations(), 1, "Reused-array callback must run");
      if (c.fast === "1" && kind !== 2) assert.ok(publications > 0, "Publication path not exercised");
    }
  }
  console.log(`Array publication: fresh/reused references, callback mutation, reload counts and instrumentation passed (${configs.length} configurations)`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
