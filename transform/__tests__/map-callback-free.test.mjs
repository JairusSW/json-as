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
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-map-purity-"));
const base = path.join(root, "transform/lib/index.js");
for (const [name, target] of [
  ["runtime", "~lib/rt/itcms"],
  ["array", "~lib/array"],
  ["map", "~lib/map"],
]) {
  fs.writeFileSync(
    path.join(dir, name + ".mjs"),
    `import Base from ${JSON.stringify(base)}; export default class extends Base { afterParse(parser) { const source = parser.sources.find(s => s.internalPath === ${JSON.stringify(target)}); if (source) source.text += " // control: source guard disabled"; super.afterParse(parser); } }`,
  );
}
const configs = [];
for (const mode of ["NAIVE", "SWAR", "SIMD"])
  for (const runtime of ["incremental", "minimal", "stub"])
    configs.push({
      mode,
      runtime,
      flags: [],
      control: null,
      enabled: runtime === "incremental",
    });
for (const flags of [
  ["--use", "ASC_RTRACE=1"],
  ["--use", "ASC_PROFILE=1"],
  ["--use", "__finalize=finalizeSnapshotObject"],
])
  configs.push({
    mode: "SWAR",
    runtime: "incremental",
    flags,
    control: null,
    enabled: false,
  });
for (const control of ["runtime", "array", "map"])
  configs.push({
    mode: "SWAR",
    runtime: "incremental",
    flags: [],
    control,
    enabled: false,
  });
const graph = {
  leaf: { n: 7, text: "ok" },
  numbers: [1, 2],
  strings: ["x", null],
};
const expected = [
  JSON.stringify({ a: graph }),
  JSON.stringify({ first: { n: 7, text: "ok" }, effect: 7 }) + "|1",
  JSON.stringify({ a: { ...graph, leaf: 7 } }) + "|1",
  JSON.stringify({ a: { n: 9 } }) + "|1",
  JSON.stringify({ a: 7 }) + "|1",
  JSON.stringify({ a: 9 }) + "|1",
  JSON.stringify({ 7: { n: 7, text: "ok" } }) + "|1",
  JSON.stringify({ n: 7, text: "ok" }) +
    "|" +
    JSON.stringify({ n: 11, text: "ok" }),
  JSON.stringify(graph),
];
let checks = 0;
try {
  for (const config of configs) {
    const wasm = path.join(dir, "purity.wasm");
    const compiled = spawnSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/map-callback-free.fixture.ts",
        "--transform",
        config.control
          ? path.join(dir, config.control + ".mjs")
          : "./transform",
        "--runtime",
        config.runtime,
        "--exportRuntime",
        "-O3",
        "-o",
        wasm,
        ...config.flags,
        ...(config.mode === "SIMD" ? ["--enable", "simd"] : []),
      ],
      {
        cwd: root,
        env: { ...process.env, JSON_MODE: config.mode },
        stdio: "pipe",
        encoding: "utf8",
        timeout: 30000,
      },
    );
    assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
    assert.doesNotMatch(
      compiled.stderr,
      /WARNING AS\d+:/,
      JSON.stringify(config),
    );
    const module = new WebAssembly.Module(fs.readFileSync(wasm));
    const imports = {};
    for (const { module: group, name } of WebAssembly.Module.imports(module)) {
      (imports[group] ??= {})[name] = (...args) => {
        if (group === "env" && name === "abort")
          throw Error(`abort ${args[2]}:${args[3]}`);
        return name === "onvisit" ? 1 : (args[0] ?? 0);
      };
    }
    const g = new WebAssembly.Instance(module, imports).exports;
    assert.equal(!!g.enabled(), config.enabled, JSON.stringify(config));
    checks++;
    for (let kind = 0; kind < 14; kind++) {
      assert.equal(
        !!g.eligible(kind),
        config.enabled && [0, 7, 8, 11, 13].includes(kind),
        JSON.stringify({ ...config, kind }),
      );
      checks++;
    }
    for (let kind = 0; kind < 4; kind++) {
      assert.equal(
        !!g.legacyMode(kind),
        true,
        JSON.stringify({ ...config, kind }),
      );
      checks++;
    }
    const decode = (ptr) =>
      Buffer.from(
        g.memory.buffer,
        ptr,
        new DataView(g.memory.buffer).getUint32(ptr - 4, true) & 0x7fffffff,
      ).toString("utf16le");
    for (let kind = 0; kind < expected.length; kind++) {
      const out = g.__pin(g.run(kind));
      assert.equal(
        decode(out),
        expected[kind],
        JSON.stringify({ ...config, kind }),
      );
      checks++;
      if (config.runtime !== "stub") g.__collect();
      assert.equal(decode(out), expected[kind]);
      checks++;
      g.__unpin(out);
    }
  }
  console.log(
    `Callback-free maps: ${checks} graph/alias/callback/GC checks across ${configs.length} configurations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
