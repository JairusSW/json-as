import { rotateText } from "./inputs.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  readSchema,
  nativeSchema,
  assemblyDriver,
  coordinatePayloads,
  stringPayloads,
} from "./generate.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const baseDir = path.join(root, "build/simdjson-parity");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "bench/simdjson/workloads.json"), "utf8"),
);
const args = process.argv.slice(2);
const command = args.shift();
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const label = option("--label", "baseline");
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error("Invalid result label");
const dir = path.join(baseDir, "runs", label);
const key = option("--case", "canada-min");
const ops = Number(option("--ops", "100"));
const pairs = Number(option("--pairs", "5"));
const varyLength = args.includes("--vary-length");
const corpus = [...manifest.corpora, ...(manifest.diagnostics ?? [])].find(
  (c) => c.layouts.some((l) => `${c.name}-${l}` === key),
);
if (!corpus) throw new Error(`Unknown workload ${key}`);
const layout = key.slice(corpus.name.length + 1);
if (!Number.isInteger(ops) || ops < 10 || !Number.isInteger(pairs) || pairs < 1)
  throw new Error("ops must be >=10; pairs must be >=1");
const relative = (p) => path.relative(root, p).split(path.sep).join("/");
const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");
const read = (p) => fs.readFileSync(p, "utf8");
function invoke(bin, argv, { log, env } = {}) {
  const result = spawnSync(bin, argv, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  if (log) fs.writeFileSync(log, output);
  if (result.error || result.status !== 0 || output.includes("abort:"))
    throw new Error(`${bin} failed: ${output}`, { cause: result.error });
  return output;
}
function verifyUpstream() {
  const revision = invoke("git", [
    "-C",
    path.join(baseDir, "upstream"),
    "rev-parse",
    "HEAD",
  ]).trim();
  if (revision !== manifest.simdjson.commit)
    throw new Error(`simdjson revision mismatch ${revision}`);
}
function bootstrap() {
  fs.mkdirSync(baseDir, { recursive: true });
  const upstream = path.join(baseDir, "upstream");
  if (!fs.existsSync(upstream))
    invoke("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      `v${manifest.simdjson.version}`,
      "https://github.com/simdjson/simdjson.git",
      upstream,
    ]);
  verifyUpstream();
  const compiler = process.env.PARITY_CXX ?? "/opt/homebrew/bin/g++-16";
  const flags = [
    "-std=c++26",
    "-freflection",
    "-O3",
    "-DNDEBUG",
    "-mcpu=native",
    `-I${upstream}/singleheader`,
  ];
  const object = path.join(baseDir, "simdjson.o");
  const source = path.join(upstream, "singleheader/simdjson.cpp");
  invoke(compiler, [...flags, "-c", source, "-o", object], {
    log: path.join(baseDir, "native-library-build.log"),
  });
  fs.writeFileSync(
    path.join(baseDir, "native-library.json"),
    JSON.stringify(
      {
        simdjson: manifest.simdjson,
        compiler: invoke(compiler, ["--version"]).trim(),
        flags,
        sourceSha256: sha(fs.readFileSync(source)),
        objectSha256: sha(fs.readFileSync(object)),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Built pinned simdjson ${manifest.simdjson.version}`);
}

function prepare() {
  for (const folder of ["generated", "inputs", "oracles", "logs", "results"])
    fs.mkdirSync(path.join(dir, folder), { recursive: true });
  const schema =
    corpus.numericShape || corpus.stringShape
      ? []
      : readSchema(path.join(root, corpus.source));
  const sourcePath = path.join(
    root,
    corpus.payload ??
      `assembly/__benches__/payloads/${corpus.name}.${layout}.json`,
  );
  const strings = corpus.stringShape
    ? stringPayloads(corpus.stringShape)
    : null;
  const text = strings ? strings[0] : read(sourcePath);
  const rotations =
    strings ??
    (corpus.numericShape
      ? coordinatePayloads(text, corpus.numericShape, 4096)
      : null);
  const inputs = [];
  for (let i = 0; i < 4; i++) {
    const rotated = rotations ? rotations[i] : rotateText(text, i, varyLength);
    JSON.parse(rotated);
    const filename = path.join(dir, `inputs/${key}.${i}.json`);
    fs.writeFileSync(filename, rotated);
    inputs.push({
      path: relative(filename),
      bytes: Buffer.byteLength(rotated),
      sha256: sha(rotated),
    });
  }
  const native =
    nativeSchema(schema, corpus.root) +
    `\n#include ${JSON.stringify(path.join(root, "bench/simdjson/native-driver.h"))}\n`;
  fs.writeFileSync(path.join(dir, `generated/${key}.cpp`), native);
  for (const mode of ["swar", "simd"]) {
    const source = assemblyDriver(
      schema,
      corpus.root,
      relative(path.join(dir, `inputs/${key}`)),
      relative(path.join(dir, `oracles/as-${mode}-${key}`)),
      ops,
      relative(path.join(dir, "generated"))
        .split("/")
        .map(() => "..")
        .join("/"),
    );
    fs.writeFileSync(path.join(dir, `generated/${key}-${mode}.ts`), source);
  }
  const xjbPath = path.join(root, "node_modules/xjb-as");
  const xjb = {
    version: JSON.parse(read(path.join(xjbPath, "package.json"))).version,
    sourcePath: fs.realpathSync(xjbPath),
    sha256: Object.fromEntries(
      ["index.ts", "xjb.ts", "dtoa.ts", "ftoa.ts"].map((file) => [
        file,
        sha(read(path.join(xjbPath, "assembly", file))),
      ]),
    ),
  };
  const sourcePatch = invoke("git", [
    "diff",
    "--binary",
    "HEAD",
    "--",
    "assembly",
    "lib",
    "transform",
  ]);
  fs.writeFileSync(path.join(dir, `generated/${key}.patch`), sourcePatch);
  const additionalSources = [];
  for (const source of invoke("git", [
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    "assembly",
    "lib",
    "transform",
  ])
    .split("\n")
    .filter((file) => file.endsWith(".ts"))) {
    const snapshot = path.join(dir, "generated/untracked", source);
    fs.mkdirSync(path.dirname(snapshot), { recursive: true });
    fs.copyFileSync(path.join(root, source), snapshot);
    additionalSources.push({
      source,
      snapshot: relative(snapshot),
      sha256: sha(read(path.join(root, source))),
    });
  }
  const metadata = {
    case: key,
    label,
    inputVariation: corpus.stringShape
      ? "Changing string values and lengths"
      : corpus.numericShape
        ? "Changing numeric values"
        : varyLength
          ? "Changing string values and lengths"
          : "Changing string values",
    xjb,
    ops,
    simdjson: manifest.simdjson,
    revision: invoke("git", ["rev-parse", "HEAD"]).trim(),
    sourcePatchSha256: sha(sourcePatch),
    additionalSources,
    schemaSource: corpus.source ?? null,
    schemaSha256: sha(
      corpus.source
        ? read(path.join(root, corpus.source))
        : JSON.stringify({ root: corpus.root }),
    ),
    diagnostic: !!(corpus.numericShape || corpus.stringShape),
    payloadSha256: sha(text),
    root: corpus.root,
    nativeRawValidation: corpus.raw
      ? "Full DOM validation before owned raw-text capture (included in parse timing)"
      : null,
    inputs,
    phases: ["parse-owned", "serialize-owned", "validate"],
    remainingRequiredFamilies: manifest.requiredFamilies.filter(
      (x) =>
        !["typed-owned-parse", "typed-owned-serialize", "validation"].includes(
          x,
        ),
    ),
    platform: invoke("uname", ["-a"]).trim(),
  };
  fs.writeFileSync(
    path.join(dir, `generated/${key}.json`),
    JSON.stringify(metadata, null, 2) + "\n",
  );
  console.log(
    `Prepared ${key}: ${schema.length} classes, ${inputs[0].bytes} bytes, ${ops} operations/phase`,
  );
}
function build() {
  verifyUpstream();
  const file = path.join(dir, `generated/${key}.json`);
  const metadata = JSON.parse(read(file));
  for (const source of metadata.additionalSources ?? []) {
    if (sha(read(path.join(root, source.source))) !== source.sha256)
      throw new Error(
        `Additional source changed since preparation: ${source.source}`,
      );
  }
  if (
    metadata.sourcePatchSha256 &&
    sha(
      invoke("git", [
        "diff",
        "--binary",
        "HEAD",
        "--",
        "assembly",
        "lib",
        "transform",
      ]),
    ) !== metadata.sourcePatchSha256
  )
    throw new Error("Parser/serializer sources changed since preparation");
  const xjbPath = path.join(root, "node_modules/xjb-as/assembly");
  for (const [source, expected] of Object.entries(metadata.xjb.sha256)) {
    if (sha(read(path.join(xjbPath, source))) !== expected)
      throw new Error(`xjb-as changed since preparation: ${source}`);
  }
  const commands = [];
  const profile = args.includes("--profile");
  const compiler = process.env.PARITY_CXX ?? "/opt/homebrew/bin/g++-16";
  const flags = [
    "-std=c++26",
    "-freflection",
    "-O3",
    "-DNDEBUG",
    "-mcpu=native",
    `-I${path.join(baseDir, "upstream/singleheader")}`,
  ];
  const cpp = path.join(dir, `generated/${key}.cpp`);
  console.log(`Building native ${key}`);
  const nativeFrom = option("--native-from", null);
  if (nativeFrom) {
    if (!/^[a-zA-Z0-9_-]+$/.test(nativeFrom))
      throw new Error("Invalid native baseline label");
    const prior = path.join(baseDir, "runs", nativeFrom);
    if (read(cpp) !== read(path.join(prior, `generated/${key}.cpp`)))
      throw new Error("Native model source differs");
    const priorMetadata = JSON.parse(
      read(path.join(prior, `generated/${key}.json`)),
    );
    if (
      priorMetadata.driverSha256?.native !==
      sha(read(path.join(root, "bench/simdjson/native-driver.h")))
    )
      throw new Error(
        "Native driver differs or its provenance is missing; rebuild without --native-from",
      );
    if (
      priorMetadata.binaries?.native?.sha256 !==
      sha(fs.readFileSync(path.join(prior, `${key}-native`)))
    )
      throw new Error("Native baseline binary differs from its recorded hash");
    fs.copyFileSync(
      path.join(prior, `${key}-native`),
      path.join(dir, `${key}-native`),
    );
  } else {
    const argv = [
      ...flags,
      cpp,
      path.join(baseDir, "simdjson.o"),
      "-o",
      path.join(dir, `${key}-native`),
    ];
    commands.push({ bin: compiler, argv });
    invoke(compiler, argv, {
      log: path.join(dir, `logs/${key}-native-build.log`),
    });
  }
  for (const mode of ["swar", "simd"]) {
    console.log(`Building AS ${key}/${mode}`);
    const tmp = path.join(dir, `${key}-${mode}.tmp`);
    const binary = path.join(dir, `${key}-${mode}.wasm`);
    const asc = [
      path.join(root, "node_modules/assemblyscript/bin/asc.js"),
      relative(path.join(dir, `generated/${key}-${mode}.ts`)),
      "--transform",
      "./transform",
      "-o",
      tmp,
      "-O3",
      "--noAssert",
      "--uncheckedBehavior",
      "always",
      "--runtime",
      "incremental",
      "--enable",
      "bulk-memory",
      "--exportStart",
      "start",
      "--exportRuntime",
    ];
    if (profile) asc.push("--debug");
    if (mode === "simd") asc.push("--enable", "simd");
    commands.push({ bin: "node", argv: asc });
    invoke("node", asc, {
      env: {
        JSON_AS_LIBRARY_SOURCE: "assembly/index",
        JSON_MODE: mode.toUpperCase(),
        JSON_STRICT: "true",
        JSON_CACHE: "0",
      },
      log: path.join(dir, `logs/${key}-${mode}-build.log`),
    });
    const opt = [
      tmp,
      "-o",
      binary,
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
    ];
    if (profile) {
      opt.splice(opt.indexOf("-s"), 2);
      opt.push("-g");
    }
    if (mode === "simd") opt.push("--enable-simd");
    commands.push({ bin: "wasm-opt", argv: opt });
    invoke("wasm-opt", opt, {
      log: path.join(dir, `logs/${key}-${mode}-opt.log`),
    });
  }
  metadata.buildCommands = commands;
  metadata.profile = profile;
  metadata.nativeFrom = nativeFrom;
  metadata.toolchain = {
    native: invoke(compiler, ["--version"]).trim(),
    nativeFlags: flags,
    v8: invoke("v8", ["--version"]).trim(),
    assemblyscript: JSON.parse(
      read(path.join(root, "node_modules/assemblyscript/package.json")),
    ).version,
    wasmOpt: invoke("wasm-opt", ["--version"]).trim(),
  };
  metadata.driverSha256 = {
    native: sha(read(path.join(root, "bench/simdjson/native-driver.h"))),
    generator: sha(read(path.join(root, "bench/simdjson/generate.mjs"))),
  };
  metadata.binaries = Object.fromEntries(
    ["native", "swar", "simd"].map((engine) => {
      const bytes = fs.readFileSync(
        path.join(dir, `${key}-${engine}${engine === "native" ? "" : ".wasm"}`),
      );
      return [engine, { bytes: bytes.length, sha256: sha(bytes) }];
    }),
  );
  fs.writeFileSync(file, JSON.stringify(metadata, null, 2) + "\n");
}
function decodeAS(output) {
  return [
    ...output.matchAll(
      /Benchmarking ([^\n]+)\n.*?\(([\d,.]+) (ns|us|ms)\/op\)/gs,
    ),
  ].map((m) => ({
    phase: m[1],
    ns:
      Number(m[2].replaceAll(",", "")) * { ns: 1, us: 1000, ms: 1000000 }[m[3]],
  }));
}
const median = (xs) => {
  const x = xs.toSorted((a, b) => a - b);
  return x.length % 2
    ? x[(x.length - 1) / 2]
    : (x[x.length / 2 - 1] + x[x.length / 2]) / 2;
};
function run() {
  const metadata = JSON.parse(read(path.join(dir, `generated/${key}.json`)));
  for (const input of metadata.inputs) {
    if (sha(fs.readFileSync(path.join(root, input.path))) !== input.sha256)
      throw new Error(`Input changed since preparation: ${input.path}`);
  }
  for (const [engine, expected] of Object.entries(metadata.binaries ?? {})) {
    const binary = path.join(
      dir,
      `${key}-${engine}${engine === "native" ? "" : ".wasm"}`,
    );
    if (sha(fs.readFileSync(binary)) !== expected.sha256)
      throw new Error(`Binary changed since build: ${engine}`);
  }
  const results = [];
  for (let pair = 0; pair < pairs; pair++) {
    for (const engine of pair % 2
      ? ["simd", "swar", "native"]
      : ["native", "swar", "simd"]) {
      console.log(`Run ${key}/${engine}, pair ${pair + 1}/${pairs}`);
      const output =
        engine === "native"
          ? invoke(
              path.join(dir, `${key}-native`),
              [
                relative(path.join(dir, `inputs/${key}`)),
                String(metadata.ops),
                relative(path.join(dir, `oracles/native-${key}`)),
              ],
              { log: path.join(dir, `logs/${key}-${engine}-${pair}.log`) },
            )
          : invoke(
              "v8",
              [
                "--no-liftoff",
                "--module",
                "bench/runners/assemblyscript.js",
                "--",
                relative(path.join(dir, `${key}-${engine}.wasm`)).replace(
                  /^build\//,
                  "",
                ),
              ],
              { log: path.join(dir, `logs/${key}-${engine}-${pair}.log`) },
            );
      const phases =
        engine === "native"
          ? output
              .split("\n")
              .filter((x) => x.startsWith("PARITY "))
              .map((x) => JSON.parse(x.slice(7)))
          : decodeAS(output);
      if (phases.length !== 3) throw new Error(`Missing phases: ${output}`);
      results.push(...phases.map((phase) => ({ ...phase, engine, pair })));
      fs.writeFileSync(
        path.join(dir, `results/${key}.json`),
        JSON.stringify({ metadata, results }, null, 2) + "\n",
      );
    }
  }
  console.log(
    invoke("python3", [
      "bench/simdjson/check-oracles.py",
      relative(path.join(dir, "oracles")),
      key,
    ]).trim(),
  );
  let failed = false;
  for (const phase of metadata.phases) {
    const native = median(
      results
        .filter((r) => r.phase === phase && r.engine === "native")
        .map((r) => r.ns),
    );
    for (const engine of ["swar", "simd"]) {
      const as = median(
        results
          .filter((r) => r.phase === phase && r.engine === engine)
          .map((r) => r.ns),
      );
      const ratio = native / as;
      console.log(
        `${ratio >= 1 ? "PASS" : "GAP"} ${key}/${phase}/${engine}: native=${native.toFixed(2)} ns, json-as=${as.toFixed(2)} ns, speedup=${ratio.toFixed(3)}x`,
      );
      if (ratio < 1) failed = true;
    }
  }
  console.log(
    `Coverage incomplete: ${metadata.remainingRequiredFamilies.join(", ")}; other corpus/layout rows also remain required.`,
  );
  if (args.includes("--gate")) process.exitCode = failed ? 1 : 2;
  if (args.includes("--gate-row")) process.exitCode = failed ? 1 : 0;
}
if (command === "bootstrap") bootstrap();
else if (command === "prepare") prepare();
else if (command === "build") build();
else if (command === "run") run();
else
  throw new Error(
    "usage: node bench/simdjson/run.mjs prepare|build|run --case canada-min --ops 100 --pairs 5 [--gate]",
  );
