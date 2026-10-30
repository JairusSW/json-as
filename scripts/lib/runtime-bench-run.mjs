import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const RUNTIMES = ["wago", "wasmtime", "wavm", "wazero", "v8", "bun"];
const VERSION_ARGS = {
  wavm: ["version"],
  wazero: ["version"],
};
const PAYLOADS = ["twitter", "citm_catalog", "canada"];
const FILES = PAYLOADS.flatMap((suite) => [
  `${suite}-pretty.deserialize.json`,
  `${suite}-min.deserialize.json`,
  `${suite}-min.serialize.json`,
]);
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const logsRoot = (root) => path.join(root, "build/logs/runtimes");

function writeJson(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(temp, file);
}

function command(root, program, args) {
  try {
    return execFileSync(program, args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

function runDirectory(root, id) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(id)) {
    throw new Error("Invalid runtime benchmark run ID");
  }
  return path.join(logsRoot(root), "runs", id);
}

export function startRuntimeRun(root, frames, compilerFlags) {
  if (!/^[1-9]\d*$/.test(frames))
    throw new Error("BENCH_FRAMES must be positive");
  const startedAt = new Date().toISOString();
  const id = `${startedAt.replace(/[:.]/g, "-")}-${randomUUID()}`;
  const directory = runDirectory(root, id);
  fs.mkdirSync(directory, { recursive: true });
  const manifest = {
    schemaVersion: 1,
    id,
    status: "running",
    startedAt,
    source: {
      commit: command(root, "git", ["rev-parse", "HEAD"]),
      branch: command(root, "git", ["rev-parse", "--abbrev-ref", "HEAD"]),
      dirty: command(root, "git", ["status", "--porcelain"]) !== "",
      packageVersion: readJson(path.join(root, "package.json")).version,
    },
    host: {
      platform: os.platform(),
      arch: os.arch(),
      cpu: os.cpus()[0]?.model,
    },
    settings: {
      frames: Number(frames),
      mode: "NAIVE",
      fastPath: process.env.JSON_USE_FAST_PATH ?? "default",
      compilerFlags,
    },
    toolVersions: Object.fromEntries([
      ["node", process.version],
      ["go", command(root, "go", ["version"])],
      ...RUNTIMES.filter((name) => name !== "wago").map((name) => [
        name,
        command(root, name, VERSION_ARGS[name] ?? ["--version"]),
      ]),
    ]),
    wagoDependencies: fs.readFileSync(
      path.join(root, "bench/runners/wago/go.mod"),
      "utf8",
    ),
    runtimes: [],
  };
  writeJson(path.join(directory, "manifest.json"), manifest);
  // Select the attempt immediately: a failed new run must not silently chart
  // the previous successful run. Older runs remain available by explicit ID.
  writeJson(path.join(logsRoot(root), "latest.json"), { id });
  return id;
}

function readResult(file) {
  const result = readJson(file);
  if (
    !Number.isFinite(result.mbps) ||
    result.mbps <= 0 ||
    !Number.isFinite(result.bytes) ||
    result.bytes <= 0
  ) {
    throw new Error(`Invalid runtime benchmark result: ${file}`);
  }
  return result;
}

export function finishRuntimeRun(root, id, status) {
  const directory = runDirectory(root, id);
  const manifestPath = path.join(directory, "manifest.json");
  const manifest = readJson(manifestPath);
  if (manifest.status !== "running") throw new Error("Run is already finished");
  if (status === "complete") {
    manifest.runtimes = RUNTIMES.filter((runtime) =>
      fs.existsSync(path.join(directory, runtime)),
    );
    if (!manifest.runtimes.length)
      throw new Error("No runtime results captured");
    for (const runtime of manifest.runtimes) {
      const runtimeDir = path.join(directory, runtime);
      if (
        fs.readdirSync(runtimeDir).sort().join() !== [...FILES].sort().join()
      ) {
        throw new Error(`Incomplete or unexpected results for ${runtime}`);
      }
      for (const file of FILES) readResult(path.join(runtimeDir, file));
    }
  } else if (status !== "failed") {
    throw new Error(`Invalid run status: ${status}`);
  }
  manifest.status = status;
  manifest.completedAt = new Date().toISOString();
  writeJson(manifestPath, manifest);
}

export function readRuntimeRun(root = process.cwd(), id = "") {
  if (!id) {
    const latest = path.join(logsRoot(root), "latest.json");
    if (!fs.existsSync(latest)) {
      throw new Error(
        "No runtime run manifest. Run npm run bench:runtimes first; legacy flat logs are not mixed into new runs.",
      );
    }
    id = readJson(latest).id;
  }
  const directory = runDirectory(root, id);
  const manifest = readJson(path.join(directory, "manifest.json"));
  if (manifest.schemaVersion !== 1 || manifest.id !== id) {
    throw new Error("Unsupported or mismatched runtime run manifest");
  }
  if (manifest.status !== "complete") {
    throw new Error(`Runtime run ${id} is ${manifest.status}, not complete`);
  }
  if (
    !Array.isArray(manifest.runtimes) ||
    !manifest.runtimes.length ||
    new Set(manifest.runtimes).size !== manifest.runtimes.length ||
    manifest.runtimes.some((runtime) => !RUNTIMES.includes(runtime))
  ) {
    throw new Error("Invalid runtime list in run manifest");
  }
  const results = Object.fromEntries(
    manifest.runtimes.map((runtime) => [
      runtime,
      Object.fromEntries(
        PAYLOADS.map((suite) => [
          suite,
          Object.fromEntries(
            ["deserialize", "serialize"].map((kind) => [
              kind,
              readResult(
                path.join(directory, runtime, `${suite}-min.${kind}.json`),
              ),
            ]),
          ),
        ]),
      ),
    ]),
  );
  return { manifest, results };
}

export function runtimeRunSubtitle(manifest) {
  const { source } = manifest;
  return `${manifest.startedAt} • v${source.packageVersion} • ${manifest.runtimes.length} runtimes · NAIVE • ${source.commit?.slice(0, 7) ?? "unknown commit"} • ${source.branch ?? "unknown branch"}${source.dirty ? " (dirty)" : ""}`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [action, id = "", ...args] = process.argv.slice(2);
  const root = process.cwd();
  if (action === "start") console.log(startRuntimeRun(root, id, args));
  else if (action === "complete" || action === "failed") {
    finishRuntimeRun(root, id, action);
  } else if (action === "select" || action === "version") {
    const { manifest } = readRuntimeRun(root, id);
    console.log(
      action === "select" ? manifest.id : manifest.source.packageVersion,
    );
  } else throw new Error(`Unknown runtime run action: ${action}`);
}
