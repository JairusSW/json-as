import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runtimeVersionArgs } from "./runtime-version.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
function command(root, program, args) {
  try {
    return execFileSync(program, args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unavailable";
  }
}
function filesBelow(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? filesBelow(file)
      : entry.isFile()
        ? [file]
        : [];
  });
}
function source(root) {
  const files = [
    "assembly",
    "bench",
    "lib",
    "transform/src",
    "transform/lib",
    "scripts",
  ]
    .flatMap((dir) => filesBelow(path.join(root, dir)))
    .concat(
      [
        "package.json",
        "package-lock.json",
        "asconfig.json",
        "tsconfig.json",
        "transform/package.json",
      ]
        .map((file) => path.join(root, file))
        .filter(fs.existsSync),
    )
    .filter((file) => !file.endsWith(".md"))
    .sort();
  const hashes = Object.fromEntries(
    files.map((file) => [
      path.relative(root, file),
      digest(fs.readFileSync(file)),
    ]),
  );
  return {
    commit: command(root, "git", ["rev-parse", "HEAD"]),
    branch: command(root, "git", ["branch", "--show-current"]),
    packageVersion: JSON.parse(fs.readFileSync(path.join(root, "package.json")))
      .version,
    treeHash: digest(JSON.stringify(hashes)),
    files: hashes,
  };
}
function logs(root) {
  return Object.fromEntries(
    filesBelow(path.join(root, "build/logs"))
      .filter((file) => /\.(as|js|wavm|wazero|wago)\.json$/.test(file))
      .map((file) => {
        const stat = fs.statSync(file, { bigint: true });
        return [
          path.relative(root, file),
          `${stat.mtimeNs}:${stat.ctimeNs}:${stat.size}`,
        ];
      }),
  );
}
export function beginBenchRun(root, settings = {}) {
  const directory = path.join(root, "build/logs/.pending");
  fs.mkdirSync(directory, { recursive: true });
  const state = {
    schemaVersion: 1,
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    source: source(root),
    settings,
    host: {
      platform: process.platform,
      arch: process.arch,
      cpu: os.cpus()[0]?.model,
    },
    drivers: Object.fromEntries(
      (settings.driverArguments || []).flatMap((argument) => {
        const file = [
          path.resolve(root, argument),
          path.resolve(root, "build", argument),
        ].find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
        return file
          ? [[path.relative(root, file), digest(fs.readFileSync(file))]]
          : [];
      }),
    ),
    tools: {
      node: process.version,
      nodeV8: process.versions.v8,
      v8: command(root, settings.d8 || "v8", ["--version"]),
      assemblyscript: command(root, process.execPath, [
        "node_modules/assemblyscript/bin/asc.js",
        "--version",
      ]),
      wasmOpt: command(root, "wasm-opt", ["--version"]),
      runtime:
        settings.runtime && settings.runtime !== "v8"
          ? command(
              root,
              settings.runtimeExecutable || settings.runtime,
              runtimeVersionArgs(settings.runtime),
            )
          : null,
    },
    logs: logs(root),
  };
  const file = path.join(directory, state.id + ".json");
  fs.writeFileSync(file, JSON.stringify(state));
  return file;
}
export function finishBenchRun(root, file) {
  const state = JSON.parse(fs.readFileSync(file));
  if (source(root).treeHash !== state.source.treeHash)
    throw new Error(
      "Benchmark sources changed during measurement; results have no valid provenance",
    );
  for (const [driver, hash] of Object.entries(state.drivers)) {
    if (digest(fs.readFileSync(path.join(root, driver))) !== hash)
      throw new Error("Benchmark driver changed during measurement");
  }
  const changed = Object.entries(logs(root)).filter(
    ([name, stamp]) => state.logs[name] !== stamp,
  );
  const metadata = { ...state };
  delete metadata.logs;
  for (const [name] of changed) {
    const artifact = path.join(root, name);
    const result = JSON.parse(fs.readFileSync(artifact));
    const manifest = {
      ...metadata,
      finishedAt: new Date().toISOString(),
      artifact: name,
      artifactHash: digest(fs.readFileSync(artifact)),
      workload: result.description,
      outputPolicy: result.description?.includes(
        "untouched JSON.Obj forwarding",
      )
        ? "untouched JSON.Obj forwarding"
        : state.settings.outputPolicy || "unspecified",
      operations: result.operations,
      bytes: result.bytes,
    };
    fs.writeFileSync(
      artifact + ".provenance.json",
      JSON.stringify(manifest, null, 2) + "\n",
    );
  }
  fs.rmSync(file);
  return changed.map(([name]) => name);
}
export function readBenchArtifact(file) {
  const bytes = fs.readFileSync(file);
  const result = JSON.parse(bytes);
  const sidecar = file + ".provenance.json";
  let provenance = null;
  if (fs.existsSync(sidecar)) {
    provenance = JSON.parse(fs.readFileSync(sidecar));
    if (
      provenance.schemaVersion !== 1 ||
      provenance.artifactHash !== digest(bytes)
    )
      throw new Error(`Benchmark provenance does not match ${file}`);
  }
  return { result, provenance };
}
export function benchProvenanceSubtitle(records, runtime = "v8") {
  if (!records.length || records.some((record) => !record))
    return "Unrecorded benchmark provenance • rerun benchmarks to record source and runtime";
  const distinct = (get) => [...new Set(records.map(get))].join(" / ");
  return `${distinct((r) => r.startedAt.slice(0, 10))} • ${distinct((r) => "v" + r.source.packageVersion)} • ${distinct((r) => r.source.commit.slice(0, 8) + "/" + r.source.treeHash.slice(0, 8))} • ${distinct((r) => (runtime === "v8" ? (r.settings.language === "js" && r.settings.source?.includes("multilib/") ? r.tools.node : r.tools.v8) : r.tools.runtime || runtime))} • strict ${distinct((r) => r.settings.strict)} • fast ${distinct((r) => r.settings.fastPath)}`;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [action, ...args] = process.argv.slice(2);
  if (action === "begin") {
    const [language, runtime, source, ...driverArguments] = args;
    const env = process.env;
    console.log(
      beginBenchRun(process.cwd(), {
        language,
        runtime,
        runtimeExecutable: env.BENCH_RUNTIME_EXECUTABLE || null,
        source,
        driverArguments,
        d8: env.D8_BIN,
        strict: env.JSON_STRICT || "false",
        fastPath: env.JSON_USE_FAST_PATH || "1",
        mode: env.JSON_MODE || "all",
        gcRuntime: env.RUNTIMES || "incremental",
        engine: env.ENGINES || "turbofan",
        turbofanFlags: env.TURBOFAN_FLAGS || "--no-liftoff",
        wavmFlags:
          env.WAVM_RUN_FLAGS ||
          "--abi=wasi --enable simd --enable bulk-memory --enable sign-extension",
        compilerFlags: env.JSON_BENCH_COMPILER_FLAGS || null,
        optimizerFlags: env.JSON_BENCH_OPTIMIZER_FLAGS || null,
        frames: 1,
        outputPolicy:
          "benchmark source (fresh, reused, lazy, or raw forwarding)",
      }),
    );
  } else if (action === "finish") finishBenchRun(process.cwd(), args[0]);
  else throw new Error("Expected begin or finish");
}
