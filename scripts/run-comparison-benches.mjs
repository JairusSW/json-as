import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  comparisonWorkload,
  comparisonWorkloads,
  digest,
  NATIVE_MODELS,
} from "./lib/comparison-workloads.mjs";
import { nativeSchema, readSchema } from "../bench/simdjson/generate.mjs";
import { beginBenchRun, finishBenchRun } from "./lib/bench-provenance.mjs";

const root = path.resolve(import.meta.dirname, "..");
const base = path.join(root, "build/comparison-baselines");
const parity = path.join(root, "build/simdjson-parity");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "bench/simdjson/workloads.json")),
);
const pin = manifest.simdjson;
const structDriver = "bench/simdjson/chart-struct-driver.h";
const generator = "bench/simdjson/generate.mjs";
const nativeBinary = (w) => path.join(base, `simdjson-${w.suite}`);
const modelSource = (w) => path.join(base, `generated/${w.suite}.cpp`);
const options = process.argv.slice(2);
const d8 = process.env.D8_BIN || "v8";
const cpp = process.env.PARITY_CXX || "/opt/homebrew/bin/g++-16";
const nativeSource = structDriver;
const jsSource = "bench/simdjson/chart-js.mjs";
const run = (bin, args) =>
  execFileSync(bin, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
const hashFile = (file) => digest(fs.readFileSync(file));
const inputPath = (w) => path.join(base, "inputs", w.suite + ".json");
const oraclePath = (w, engine) =>
  path.join(base, "oracles", w.suite + "." + engine + ".json");
const operations = (w) =>
  Math.max(10, Math.min(1_000_000, Math.ceil((256 * 1024 * 1024) / w.bytes)));
function invoke(w, engine, mode) {
  const args = [
    inputPath(w),
    String(operations(w)),
    oraclePath(w, engine),
    mode,
  ];
  return engine === "simdjson"
    ? run(nativeBinary(w), args)
    : run(d8, [
        "--no-liftoff",
        "--no-wasm-tier-up",
        "--allow-natives-syntax",
        "--module",
        jsSource,
        "--",
        ...args,
        String(w.bytes),
      ]);
}
function checkOracle(w, engine) {
  if (engine === "js-classic") {
    assert.deepEqual(
      JSON.parse(fs.readFileSync(oraclePath(w, engine), "utf8")),
      JSON.parse(JSON.stringify(JSON.parse(w.text))),
      w.suite,
    );
  } else {
    run("python3", [
      "bench/simdjson/check-model.py",
      inputPath(w),
      oraclePath(w, engine),
      modelSource(w) + ".json",
    ]);
  }
}
function prepare(workloads) {
  let prior;
  try {
    prior = JSON.parse(fs.readFileSync(path.join(base, "manifest.json")));
  } catch {}

  for (const name of ["inputs", "oracles", "logs", "generated"])
    fs.mkdirSync(path.join(base, name), { recursive: true });
  if (!fs.existsSync(path.join(parity, "simdjson.o")))
    run(process.execPath, ["bench/simdjson/run.mjs", "bootstrap"]);
  assert.equal(
    run("git", [
      "-C",
      path.join(parity, "upstream"),
      "rev-parse",
      "HEAD",
    ]).trim(),
    pin.commit,
  );
  run("git", [
    "-C",
    path.join(parity, "upstream"),
    "diff",
    "--exit-code",
    "HEAD",
    "--",
    "singleheader",
  ]);
  const library = JSON.parse(
    fs.readFileSync(path.join(parity, "native-library.json")),
  );
  assert.equal(library.simdjson.commit, pin.commit);
  assert.equal(library.objectSha256, hashFile(path.join(parity, "simdjson.o")));
  assert.equal(
    library.sourceSha256,
    hashFile(path.join(parity, "upstream/singleheader/simdjson.cpp")),
  );
  const flags = [...library.flags, "-fconstexpr-ops-limit=268435456"];
  const models = {};
  const compiledModels = new Map();
  if (
    prior?.structDriverSha256 === hashFile(structDriver) &&
    prior.generatorSha256 === hashFile(generator) &&
    prior.library.objectSha256 === library.objectSha256 &&
    prior.compiler === run(cpp, ["--version"]).trim() &&
    JSON.stringify(prior.flags) === JSON.stringify(flags)
  ) {
    for (const [suite, model] of Object.entries(prior.models ?? {})) {
      const file = path.join(base, `simdjson-${suite}`);
      if (fs.existsSync(file) && hashFile(file) === model.binarySha256)
        compiledModels.set(model.generatedSha256, file);
    }
  }
  for (const w of workloads) {
    {
      const name = w.suite.replace(/-(min|pretty)$/, "");
      const corpus =
        w.group === "classic"
          ? manifest.corpora.find((c) => c.name === name)
          : NATIVE_MODELS[w.suite];
      assert.ok(corpus, `Missing owning model: ${w.suite}`);
      const declared = readSchema(path.join(root, corpus.source));
      const classes = new Map(declared.map((c) => [c.name, c]));
      const used = new Set();
      const visit = (type) => {
        for (const name of type.match(/[A-Za-z_]\w*/g) ?? []) {
          if (!classes.has(name) || used.has(name)) continue;
          used.add(name);
          for (const field of classes.get(name).fields) visit(field.type);
        }
      };
      visit(corpus.root);
      const schema = declared.filter((c) => used.has(c.name));
      // For overview/library fixtures every supplied field is checked below.
      // Their explicit defaults never run in C++; an omitted explicit default
      // is rejected by the oracle rather than guessed by this adapter.
      if (w.group !== "classic") {
        for (const model of schema)
          for (const field of model.fields) {
            if (field.initializer === null) continue;
            try {
              JSON.parse(field.initializer);
            } catch {
              const constructed = /^new\s+(\w+)\(\)$/.exec(field.initializer);
              assert.ok(
                constructed && classes.has(constructed[1]),
                `Unsupported explicit native default: ${model.name}.${field.name}`,
              );
            }
          }
      }
      const nativeModel =
        w.group === "classic"
          ? schema
          : schema.map((c) => ({
              ...c,
              fields: c.fields.map((f) => ({ ...f, initializer: null })),
            }));
      fs.writeFileSync(
        modelSource(w) + ".json",
        JSON.stringify({ root: corpus.root, classes: schema }),
      );
      fs.writeFileSync(
        modelSource(w),
        nativeSchema(nativeModel, corpus.root, { unknownFields: "ignore" }) +
          `\n#include ${JSON.stringify(path.join(root, structDriver))}\n`,
      );
      const modelHash = hashFile(modelSource(w));
      if (compiledModels.has(modelHash)) {
        if (compiledModels.get(modelHash) !== nativeBinary(w))
          fs.copyFileSync(compiledModels.get(modelHash), nativeBinary(w));
      } else {
        run(cpp, [
          ...flags,
          modelSource(w),
          path.join(parity, "simdjson.o"),
          "-o",
          nativeBinary(w),
        ]);
        compiledModels.set(modelHash, nativeBinary(w));
      }
      models[w.suite] = {
        representation:
          corpus.root === "string"
            ? "owning native string"
            : "owning native struct",
        unknownFields: "ignore",
        rawValidation: false,
        source: corpus.source,
        sourceSha256: hashFile(corpus.source),
        generatedSha256: hashFile(modelSource(w)),
        schemaSha256: hashFile(modelSource(w) + ".json"),
        binarySha256: hashFile(nativeBinary(w)),
      };
    }
    fs.writeFileSync(inputPath(w), w.text);
    for (const engine of w.group === "classic"
      ? ["simdjson", "js-classic"]
      : ["simdjson"]) {
      invoke(w, engine, "check");
      checkOracle(w, engine);
    }
    console.log(`Checked ${w.group}/${w.suite}`);
  }
  const metadata = {
    models,
    structDriverSha256: hashFile(structDriver),
    generatorSha256: hashFile(generator),
    simdjson: pin,
    library,
    compiler: run(cpp, ["--version"]).trim(),
    flags,
    nativeSourceSha256: hashFile(nativeSource),
    jsSourceSha256: hashFile(jsSource),
    workloads: workloads.map((w) => {
      const descriptor = { ...w };
      delete descriptor.text;
      return descriptor;
    }),
  };
  fs.writeFileSync(
    path.join(base, "manifest.json"),
    JSON.stringify(metadata, null, 2),
  );
}
function measure(workloads) {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(base, "manifest.json")),
  );
  assert.equal(metadata.structDriverSha256, hashFile(structDriver));
  assert.equal(metadata.generatorSha256, hashFile(generator));
  assert.equal(metadata.nativeSourceSha256, hashFile(nativeSource));
  assert.equal(metadata.jsSourceSha256, hashFile(jsSource));
  assert.deepEqual(
    metadata.workloads,
    workloads.map((w) => {
      const descriptor = { ...w };
      delete descriptor.text;
      return descriptor;
    }),
  );
  for (const w of workloads) {
    assert.equal(hashFile(inputPath(w)), w.inputSha256);
    {
      const model = metadata.models[w.suite];
      assert.equal(model.binarySha256, hashFile(nativeBinary(w)));
      assert.equal(model.generatedSha256, hashFile(modelSource(w)));
      assert.equal(model.schemaSha256, hashFile(modelSource(w) + ".json"));
      assert.equal(model.sourceSha256, hashFile(model.source));
    }
    for (const engine of w.group === "classic"
      ? ["simdjson", "js-classic"]
      : ["simdjson"]) {
      const language = engine === "simdjson" ? "native" : "js";
      const runtime = engine === "simdjson" ? "native" : "v8";
      const pending = beginBenchRun(root, {
        language,
        runtime,
        runtimeExecutable: engine === "simdjson" ? nativeBinary(w) : d8,
        d8,
        source: engine === "simdjson" ? structDriver : jsSource,
        driverArguments: [
          nativeBinary(w),
          nativeSource,
          structDriver,
          generator,
          jsSource,
          inputPath(w),
        ],
        inputSha256: w.inputSha256,
        native: metadata,
        strict:
          engine === "simdjson"
            ? "typed fields; raw lexeme boundaries"
            : "full validation",
        fastPath: "n/a",
        outputPolicy:
          engine === "simdjson"
            ? "fresh owning native typed value; copied strings and containers; native fields to fresh UTF-8 string"
            : "built-in JSON.parse/stringify; fresh results; v1.6.1 JS checkpoint blackbox",
      });
      const phases = { deserialize: [], serialize: [] };
      for (let repeat = 0; repeat < 3; repeat++) {
        const stdout = invoke(w, engine, "measure");
        fs.writeFileSync(
          path.join(base, "logs", `${w.suite}.${engine}.${repeat}.txt`),
          stdout,
        );
        const rows = stdout
          .split("\n")
          .filter((s) => s.startsWith("BASELINE "))
          .map((s) => JSON.parse(s.slice(9)));
        assert.equal(rows.length, 2);
        for (const row of rows) {
          assert.ok(row.elapsed > 0 && row.nsPerOp > 0);
          phases[row.kind].push(row);
        }
        checkOracle(w, engine);
      }
      for (const [kind, samples] of Object.entries(phases)) {
        assert.equal(samples.length, 3);
        samples.sort((a, b) => a.nsPerOp - b.nsPerOp);
        const result = {
          ...samples[1],
          language,
          description: `${engine === "simdjson" ? "simdjson native typed value" : "Built-in JSON (JS/V8)"} ${kind} ${w.suite}`,
          group: w.group,
          suite: w.suite,
          inputSha256: w.inputSha256,
          inputSource: w.source,
          outputBytes: fs.statSync(oraclePath(w, engine)).size,
          features: [],
          samples,
        };
        const out = path.join(
          root,
          "build/logs",
          engine === "simdjson" ? "native/simdjson" : "js",
          `${engine === "js-classic" ? "classic-" : ""}${w.suite}.${kind}.${language}.json`,
        );
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify(result, null, 2));
      }
      finishBenchRun(root, pending);
      console.log(`Measured ${engine}/${w.suite}`);
    }
  }
}
const selection = options
  .find((s) => s.startsWith("--suites="))
  ?.slice(9)
  .split(",");
const workloads = selection
  ? selection.map((suite) => comparisonWorkload(root, suite))
  : comparisonWorkloads(root);
assert.ok(workloads.length, "No comparison workloads selected");
if (!options.includes("--run-only")) prepare(workloads);
if (!options.includes("--prepare-only")) measure(workloads);
