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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-batches-"));
try {
  let checks = 0;
  const compile = (
    fixture,
    output,
    mode,
    strict,
    fast,
    extra = [],
    transform = "./transform",
  ) => {
    execFileSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        fixture,
        "--transform",
        transform,
        "-O3",
        "--runtime",
        "incremental",
        "--enable",
        "simd",
        "--exportRuntime",
        "--exportStart",
        "start",
        "-o",
        output,
        ...extra,
      ],
      {
        env: {
          ...process.env,
          JSON_MODE: mode,
          JSON_STRICT: strict,
          JSON_USE_FAST_PATH: fast,
          JSON_CACHE: "0",
        },
        stdio: "pipe",
      },
    );
  };
  const instantiate = async (module) => {
    const instance = await WebAssembly.instantiate(module, {
      env: {
        abort(m, f, l, c) {
          throw new Error(`abort ${l}:${c}`);
        },
      },
    });
    instance.exports.start();
    return instance;
  };
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const strict of ["false", "true"])
      for (const fast of ["0", "1"]) {
        const output = path.join(dir, "stress.wasm");
        compile(
          "assembly/__tests__/allocation-batches.fixture.ts",
          output,
          mode,
          strict,
          fast,
          ["--maximumMemory", "8"],
        );
        const instance = await instantiate(
          await WebAssembly.compile(fs.readFileSync(output)),
        );
        assert.equal(instance.exports.verify(), 1, `${mode}/${strict}/${fast}`);
        assert.ok(instance.exports.memory.buffer.byteLength <= 8 * 65536);
        checks++;
      }
  const original = path.resolve("transform/lib/index.js");
  const controls = {
    control: `const runtime=parser.sources.find(s=>s.internalPath.endsWith('assembly/util/runtime'));const helper=runtime.statements.find(n=>n.name?.text==='allocateObject');helper.body.statements[0].value.expression=Node.createIdentifierExpression('__new',helper.range);`,
    noRelease: `const tlsf=parser.sources.find(s=>s.internalPath==='~lib/rt/tlsf');const fn=tlsf.statements.find(n=>n.name?.text==='allocateBlock');const growth=fn.body.statements.find(n=>n.ifTrue?.statements?.length===2&&n.ifTrue.statements[1].ifTrue);if(!growth)throw Error('Missing batch-release hook');growth.ifTrue=growth.ifTrue.statements[1].ifTrue;`,
  };
  const modules = {};
  for (const pages of [1, 4]) {
    modules[pages] = {};
    for (const name of pages === 1
      ? ["control", "candidate"]
      : ["control", "noRelease", "candidate"]) {
      let transform = "./transform";
      if (controls[name]) {
        transform = path.join(dir, name + ".mjs");
        fs.writeFileSync(
          transform,
          `import Transformer from ${JSON.stringify(original)};import {Node} from ${JSON.stringify(path.resolve("node_modules/assemblyscript/dist/assemblyscript.js"))};export default class extends Transformer {afterParse(parser){super.afterParse(parser);${controls[name]}}}`,
        );
      }
      const output = path.join(dir, name + pages + ".wasm");
      compile(
        "assembly/__tests__/allocation-pressure.fixture.ts",
        output,
        "SIMD",
        "false",
        "1",
        ["--initialMemory", String(pages), "--maximumMemory", String(pages)],
        transform,
      );
      modules[pages][name] = await WebAssembly.compile(fs.readFileSync(output));
    }
  }
  let fallbackCases = 0;
  for (const reserve of [4608, 5120, 6144, 8192]) {
    const control = await instantiate(modules[1].control);
    let fits = false;
    try {
      fits = control.exports.verify(true, reserve, true) === 0;
    } catch {
      /* The native control can itself exceed the fixed heap. */
    }
    if (!fits) continue;
    const candidate = await instantiate(modules[1].candidate);
    assert.equal(
      candidate.exports.verify(true, reserve, true),
      0,
      "small heaps retain individual allocation behavior",
    );
    assert.equal(
      candidate.exports.beforeTail(),
      0,
      "no speculative batch in a tightly constrained heap",
    );
    fallbackCases++;
  }
  assert.ok(
    fallbackCases > 0,
    "require a fitting fixed-memory native-view control",
  );
  let demonstrated = false;
  for (let reserve = 4096; reserve <= 8192; reserve += 256) {
    const results = {};
    const instances = {};
    for (const [name, module] of Object.entries(modules[4])) {
      try {
        const instance = await instantiate(module);
        instances[name] = instance;
        results[name] = instance.exports.verify(true, reserve, false);
      } catch (error) {
        results[name] = String(error);
      }
    }
    if (
      results.control === 0 &&
      results.candidate === 0 &&
      results.noRelease !== 0
    ) {
      assert.ok(
        instances.candidate.exports.beforeTail() > 0,
        "the pressure case actually reserves a batch tail",
      );
      assert.equal(
        instances.candidate.exports.afterTail(),
        0,
        "native buffer allocation releases the unused tail",
      );
      const first = await instantiate(modules[4].candidate);
      assert.equal(
        first.exports.verify(false, reserve, false),
        0,
        "buffer-first allocation keeps the individual fallback",
      );
      demonstrated = true;
      break;
    }
  }
  assert.ok(
    demonstrated,
    "pressure control must exercise and require batch-tail release",
  );
  console.log(
    `Allocation batches: size classes, native neighbors, retained graphs and GC passed in ${checks} configurations; fixed-memory release control passed`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
