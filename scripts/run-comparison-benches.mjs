import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { comparisonWorkloads, digest } from "./lib/comparison-workloads.mjs";
import { beginBenchRun, finishBenchRun } from "./lib/bench-provenance.mjs";

const root = path.resolve(import.meta.dirname, "..");
const base = path.join(root, "build/comparison-baselines");
const parity = path.join(root, "build/simdjson-parity");
const pin = JSON.parse(
  fs.readFileSync(path.join(root, "bench/simdjson/workloads.json")),
).simdjson;
const options = process.argv.slice(2);
const d8 = process.env.D8_BIN || "v8";
const cpp = process.env.PARITY_CXX || "/opt/homebrew/bin/g++-16";
const native = path.join(base, "simdjson-chart");
const nativeSource = "bench/simdjson/chart-driver.cpp";
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
    ? run(native, args)
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
      "-c",
      "import json,sys;\nreject=lambda s: (_ for _ in ()).throw(ValueError(s));\na=json.load(open(sys.argv[1]),parse_constant=reject); b=json.load(open(sys.argv[2]),parse_constant=reject); assert a==b,sys.argv[1]",
      inputPath(w),
      oraclePath(w, engine),
    ]);
  }
}
function prepare(workloads) {
  for (const name of ["inputs", "oracles", "logs"])
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
  const flags = [
    ...library.flags,
    nativeSource,
    path.join(parity, "simdjson.o"),
    "-o",
    native,
  ];
  fs.writeFileSync(path.join(base, "build.log"), run(cpp, flags));
  for (const w of workloads) {
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
    simdjson: pin,
    library,
    compiler: run(cpp, ["--version"]).trim(),
    flags,
    binarySha256: hashFile(native),
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
  assert.equal(metadata.binarySha256, hashFile(native));
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
    for (const engine of w.group === "classic"
      ? ["simdjson", "js-classic"]
      : ["simdjson"]) {
      const language = engine === "simdjson" ? "native" : "js";
      const runtime = engine === "simdjson" ? "native" : "v8";
      const pending = beginBenchRun(root, {
        language,
        runtime,
        runtimeExecutable: engine === "simdjson" ? native : d8,
        d8,
        source: engine === "simdjson" ? nativeSource : jsSource,
        driverArguments: [native, nativeSource, jsSource, inputPath(w)],
        inputSha256: w.inputSha256,
        native: metadata,
        strict: "full validation",
        fastPath: "n/a",
        outputPolicy:
          engine === "simdjson"
            ? "DOM parsing with reused parser-owned tape; fresh owned UTF-8 strings from DOM"
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
          description: `${engine === "simdjson" ? "simdjson native DOM" : "Built-in JSON (JS/V8)"} ${kind} ${w.suite}`,
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
const workloads = comparisonWorkloads(root);
if (!options.includes("--run-only")) prepare(workloads);
if (!options.includes("--prepare-only")) measure(workloads);
