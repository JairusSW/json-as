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
import ts from "typescript";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-lazy-api-"));
let checks = 0;
try {
  for (const mode of process.env.PROBE_QUICK
    ? ["SWAR"]
    : ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of process.env.PROBE_QUICK
      ? ["incremental"]
      : ["incremental", "minimal", "stub"])
      for (const strict of [false, true]) {
        const wasm = path.join(dir, "probe.wasm");
        const c = spawnSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            "assembly/__tests__/access-lazy.fixture.ts",
            "--transform",
            "./transform",
            "--runtime",
            runtime,
            "-O3",
            "-o",
            wasm,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: String(strict),
              JSON_LAZY: "true",
            },
          },
        );
        assert.equal(c.status, 0, c.stdout + c.stderr);
        assert.doesNotMatch(c.stdout + c.stderr, /(?:WARNING|INFO) AS\d+/);
        const g = new WebAssembly.Instance(
          new WebAssembly.Module(fs.readFileSync(wasm)),
          {
            env: {
              abort() {
                throw Error("abort");
              },
            },
          },
        ).exports;
        const decode = (p) =>
          Buffer.from(
            g.memory.buffer,
            p,
            new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
          ).toString("utf16le");
        assert.equal(g.partial(), 42);
        assert.equal(decode(g.full()), "42:hello");
        assert.equal(decode(g.serialized()), '42|{"id":42,"body":"hello"}');
        assert.equal(g.eager(), 84);
        assert.equal(
          decode(g.inherited()),
          '{"id":42,"body":"hello","tail":3}',
        );
        assert.equal(decode(g.escaped()), "hello");
        assert.equal(decode(g.reuse()), "7:new");
        assert.equal(g.noDeferredSlots(), 1);
        assert.equal(decode(g.dynamic()), '[{"n":2},null]');
        assert.equal(g.internalHelper(), 1);
        checks += 10;
      }

  for (const retired of [
    '@json({ lazy: "strategic" })',
    '@json({ lazy: "all" })',
    '@json({ lazy: "auto" })',
    '@json({ lazy: "none" })',
    "@json class Bad { @lazy value: i32 = 0; }",
    "@json class Bad { @eager value: i32 = 0; }",
  ]) {
    const file = path.join(dir, "retired.ts");
    const source = retired.includes("class")
      ? retired
      : `${retired} class Bad { value: i32 = 0; }`;
    fs.writeFileSync(file, source);
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        file,
        "--transform",
        "./transform",
        "--noEmit",
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /removed/);
    checks++;
  }

  // Test the actual editor surface rather than assuming namespace exports hide.
  const file = path.resolve("build/lazy-editor-probe.ts");
  const source = 'import { JSON } from "../assembly/index";\nJSON.';
  const options = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
  };
  const host = {
    getScriptFileNames: () => [file],
    getScriptVersion: () => "1",
    getScriptSnapshot: (f) =>
      f === file
        ? ts.ScriptSnapshot.fromString(source)
        : fs.existsSync(f)
          ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, "utf8"))
          : undefined,
    getCurrentDirectory: () => process.cwd(),
    getCompilationSettings: () => options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (f) => f === file || ts.sys.fileExists(f),
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  };
  const service = ts.createLanguageService(host);
  const names =
    service
      .getCompletionsAtPosition(file, source.length, {})
      ?.entries.map((e) => e.name) || [];
  for (const name of [
    "parse",
    "stringify",
    "validate",
    "Value",
    "Obj",
    "Arr",
    "Box",
  ])
    assert.ok(names.includes(name), name);
  assert.ok(!names.some((name) => name.startsWith("__")));
  for (const name of ["Lazy", "Util", "internal"])
    assert.ok(!names.includes(name));
  service.dispose();
  console.log(
    `Lazy API: ${checks} optimized runtime/migration checks; public completions contain no internal helpers`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
