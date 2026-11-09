// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// Staged classic throughput gate. Preparation is untimed; wrap --measure in
// ~/benchmark-lock.py. Timed AS calls stay in the original classic harness.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { CLASSIC, digest } from "./lib/comparison-workloads.mjs";
import { readSchema } from "../bench/simdjson/generate.mjs";
const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.find((s) => s.startsWith(name + "="))?.slice(name.length + 1) ??
  fallback;
const names = option("--corpora", CLASSIC.join(",")).split(",");
assert.ok(names.every((n) => CLASSIC.includes(n)));
assert.equal(new Set(names).size, names.length, "Duplicate classic corpus");
const base = path.join(root, "build/classic-parity");
fs.mkdirSync(base, { recursive: true });
const manifest = JSON.parse(fs.readFileSync("bench/simdjson/workloads.json"));
const corpora = names.map((name) =>
  manifest.corpora.find((c) => c.name === name),
);
const run = (bin, argv, env = {}) =>
  execFileSync(bin, argv, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
const hash = (file) => digest(fs.readFileSync(file));
const binary = (name) => path.join(base, `${name}.wasm`);
const files = (folder) =>
  fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(folder, entry.name);
    return entry.isDirectory()
      ? files(name)
      : /\.(ts|js|json)$/.test(name)
        ? [name]
        : [];
  });
const sourceFiles = [
  ...files("assembly"),
  ...files("lib"),
  ...files("transform/lib"),
  ...files("node_modules/assemblyscript/std/assembly"),
  ...files("node_modules/xjb-as/assembly"),
  "node_modules/assemblyscript/dist/asc.js",
  "node_modules/assemblyscript/dist/assemblyscript.js",
  "scripts/run-classic-parity.mjs",
  "scripts/run-comparison-benches.mjs",
  "bench/simdjson/chart-struct-driver.h",
  "bench/simdjson/generate.mjs",
  "bench/simdjson/check-model.py",
  "bench/runners/assemblyscript.js",
  "package.json",
];
const sourceHash = () =>
  digest(sourceFiles.map((f) => f + ":" + hash(f)).join("\n"));
const suites = corpora.flatMap((c) =>
  c.layouts.map((layout) => `${c.name}-${layout}`),
);
const nativeBase = path.join(root, "build/comparison-baselines");
const oracle = (suite, engine) => path.join(base, `${suite}.${engine}.json`);
const flags = [
  "-O3",
  "--noAssert",
  "--uncheckedBehavior",
  "always",
  "--runtime",
  "incremental",
  "--enable",
  "bulk-memory",
  "--enable",
  "simd",
  "--exportStart",
  "start",
  "--exportRuntime",
];
const opt = [
  "-O4",
  "-tnh",
  "-iit",
  "-ifwl",
  "-s",
  "0",
  "--enable-bulk-memory",
  "--enable-nontrapping-float-to-int",
  "--enable-tail-call",
  "--enable-sign-ext",
  "--enable-mutable-globals",
  "--enable-simd",
];
const env = {
  JSON_MODE: "SIMD",
  JSON_STRICT: "false",
  JSON_USE_FAST_PATH: "1",
  JSON_CACHE: "0",
};
if (args.includes("--prepare")) {
  fs.mkdirSync(path.join(base, "generated"), { recursive: true });
  run(process.execPath, [
    "scripts/run-comparison-benches.mjs",
    "--prepare-only",
    `--suites=${suites.join(",")}`,
  ]);
  for (const corpus of corpora) {
    const build = (source, output) => {
      run(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          source,
          "--transform",
          "./transform",
          "-o",
          output + ".tmp",
          ...flags,
        ],
        env,
      );
      run("wasm-opt", [output + ".tmp", "-o", output, ...opt]);
    };
    build(corpus.source, binary(corpus.name));
    const schema = readSchema(corpus.source);
    const generated = path.join(base, "generated", `${corpus.name}.ts`);
    // Full graph oracle retained through additional parses and collection.
    // Every result is independently serialized after collection.
    fs.writeFileSync(
      generated,
      `import {JSON} from "../../../assembly/index";\nimport {readFile,writeFile,blackbox} from "../../../assembly/__benches__/lib/bench";\n${schema.map((c) => c.source).join("\n")}\n` +
        corpus.layouts
          .map(
            (layout, i) =>
              `let text${i}=readFile("assembly/__benches__/payloads/${corpus.name}.${layout}.json");\nconst value${i}=JSON.parse<${corpus.root}>(text${i});\nfor(let i=0;i<16;i++)blackbox(JSON.parse<${corpus.root}>(text${i}));\ntext${i}="";\n`,
          )
          .join("") +
        `__collect();\n` +
        corpus.layouts
          .map(
            (layout, i) =>
              `writeFile(${JSON.stringify(oracle(`${corpus.name}-${layout}`, "as"))},JSON.stringify(value${i}));`,
          )
          .join("\n"),
    );
    const checkBinary = path.join(base, `${corpus.name}-oracle.wasm`);
    build(generated, checkBinary);
    run("v8", [
      "--no-liftoff",
      "--module",
      "bench/runners/assemblyscript.js",
      "--",
      path.relative(path.join(root, "build"), checkBinary),
    ]);
    for (const layout of corpus.layouts) {
      const suite = `${corpus.name}-${layout}`;
      run("python3", [
        "bench/simdjson/check-model.py",
        path.join(nativeBase, "inputs", suite + ".json"),
        oracle(suite, "as"),
        path.join(nativeBase, "generated", suite + ".cpp.json"),
      ]);
    }
    console.log(`Built and checked full owned ${corpus.name} graph`);
  }
  const prepared = {
    sourceHash: sourceHash(),
    env,
    flags,
    opt,
    corpora: names,
    native: JSON.parse(fs.readFileSync(path.join(nativeBase, "manifest.json"))),
    binaries: Object.fromEntries(
      names.map((name) => [name, hash(binary(name))]),
    ),
    compiler: run(process.execPath, [
      "node_modules/assemblyscript/bin/asc.js",
      "--version",
    ]).trim(),
    v8: run("v8", ["--version"]).trim(),
  };
  fs.writeFileSync(
    path.join(base, "prepared.json"),
    JSON.stringify(prepared, null, 2),
  );
}
if (args.includes("--measure")) {
  const prepared = JSON.parse(
    fs.readFileSync(path.join(base, "prepared.json")),
  );
  assert.equal(
    prepared.sourceHash,
    sourceHash(),
    "Source changed since preparation",
  );
  assert.deepEqual(prepared.corpora, names);
  for (const name of names)
    assert.equal(hash(binary(name)), prepared.binaries[name]);
  assert.equal(
    hash("bench/simdjson/chart-struct-driver.h"),
    prepared.native.structDriverSha256,
  );
  assert.equal(
    hash("bench/simdjson/generate.mjs"),
    prepared.native.generatorSha256,
  );
  for (const suite of suites) {
    const model = prepared.native.models[suite];
    const input = prepared.native.workloads.find((w) => w.suite === suite);
    assert.equal(
      hash(path.join(nativeBase, `simdjson-${suite}`)),
      model.binarySha256,
    );
    assert.equal(
      hash(path.join(nativeBase, `inputs/${suite}.json`)),
      input.inputSha256,
    );
    assert.equal(
      hash(path.join(nativeBase, `generated/${suite}.cpp`)),
      model.generatedSha256,
    );
    assert.equal(
      hash(path.join(nativeBase, `generated/${suite}.cpp.json`)),
      model.schemaSha256,
    );
  }
  const pairs = Number(option("--pairs", "5"));
  assert.ok(
    Number.isInteger(pairs) && pairs >= 5,
    "At least five process pairs required",
  );
  const threshold = Number(option("--threshold", "0.5"));
  assert.ok(threshold > 0);
  const samples = [];
  const evidence = {
    head: run("git", ["rev-parse", "HEAD"]).trim(),
    date: new Date().toISOString(),
    arch: process.arch,
    power: run("pmset", ["-g", "batt"]),
    prepared,
    samples,
  };
  for (const corpus of corpora) {
    for (let pair = 0; pair < pairs; pair++) {
      for (const engine of pair % 2 ? ["as", "native"] : ["native", "as"]) {
        const sample = {
          corpus: corpus.name,
          pair,
          engine,
          audit: run("ps", ["-Ao", "pid,pcpu,comm", "-r"])
            .split("\n")
            .slice(0, 12),
          ns: {},
        };
        if (engine === "as") {
          const output = run("v8", [
            "--no-liftoff",
            "--module",
            "bench/runners/assemblyscript.js",
            "--",
            path.relative(path.join(root, "build"), binary(corpus.name)),
          ]);
          fs.writeFileSync(
            path.join(base, `${corpus.name}.${pair}.as.log`),
            output,
          );
          for (const match of output.matchAll(
            /Benchmarking Deserialize [^\n]+\((min|pretty)\)\n\s+Completed benchmark[^\n]+\(([0-9.]+) us\/op\)/g,
          ))
            sample.ns[match[1]] = Number(match[2]) * 1000;
          assert.equal(
            Object.keys(sample.ns).length,
            corpus.layouts.length,
            output,
          );
        } else {
          for (const layout of corpus.layouts) {
            const suite = `${corpus.name}-${layout}`;
            const bytes = fs.statSync(
              path.join(nativeBase, "inputs", suite + ".json"),
            ).size;
            const ops = Math.max(
              100,
              Math.min(100000, Math.ceil((512 * 1024 * 1024) / bytes)),
            );
            const output = run(path.join(nativeBase, `simdjson-${suite}`), [
              path.join(nativeBase, "inputs", suite + ".json"),
              String(ops),
              oracle(suite, "native"),
              "measure",
            ]);
            fs.writeFileSync(
              path.join(base, `${suite}.${pair}.native.log`),
              output,
            );
            const row = output
              .split("\n")
              .filter((s) => s.startsWith("BASELINE "))
              .map((s) => JSON.parse(s.slice(9)))
              .find((r) => r.kind === "deserialize");
            sample.ns[layout] = row.nsPerOp;
            run("python3", [
              "bench/simdjson/check-model.py",
              path.join(nativeBase, "inputs", suite + ".json"),
              oracle(suite, "native"),
              path.join(nativeBase, "generated", suite + ".cpp.json"),
            ]);
          }
        }
        samples.push(sample);
        fs.writeFileSync(
          path.join(base, "samples.json"),
          JSON.stringify(evidence, null, 2),
        );
        console.log(corpus.name, pair, engine, sample.ns);
      }
    }
  }
  const median = (values) => {
    values.sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return values.length % 2
      ? values[middle]
      : (values[middle - 1] + values[middle]) / 2;
  };
  const rows = corpora.flatMap((c) =>
    c.layouts.map((layout) => {
      const ns = Object.fromEntries(
        ["as", "native"].map((engine) => [
          engine,
          median(
            samples
              .filter((s) => s.corpus === c.name && s.engine === engine)
              .map((s) => s.ns[layout]),
          ),
        ]),
      );
      return {
        corpus: c.name,
        layout,
        ...ns,
        throughputFraction: ns.native / ns.as,
        pass: ns.native / ns.as >= threshold,
      };
    }),
  );
  const result = {
    threshold,
    completeClassicCoverage: names.length === CLASSIC.length,
    rows,
    pass: rows.every((r) => r.pass),
  };
  fs.writeFileSync(
    path.join(base, "result.json"),
    JSON.stringify(result, null, 2),
  );
  console.table(rows);
  if (!result.pass) process.exitCode = 1;
}
assert.ok(
  args.includes("--prepare") || args.includes("--measure"),
  "Use --prepare or --measure",
);
