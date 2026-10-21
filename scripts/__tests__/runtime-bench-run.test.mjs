import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import {
  readRuntimeRun,
  runtimeRunSubtitle,
} from "../lib/runtime-bench-run.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const result = JSON.stringify({ mbps: 123, bytes: 4096 });

// No compiler, Go build, real runtime, network, or benchmark is used. Run the
// actual shell orchestration with deterministic command fixtures on an isolated
// PATH, so removing an engine really simulates it no longer being installed.
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-runtime-run-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  for (const command of [
    "bash",
    "dirname",
    "mkdir",
    "mktemp",
    "cp",
    "rm",
    "find",
  ]) {
    fs.symlinkSync(`/bin/${command}`, path.join(bin, command));
  }
  fs.symlinkSync(process.execPath, path.join(bin, "node"));
  for (const file of [
    "scripts/run-bench.runtimes.sh",
    "scripts/publish-benchmarks.sh",
    "scripts/lib/runtime-bench-run.mjs",
    "bench/runners/wago/go.mod",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(repo, file), path.join(root, file));
  }
  fs.writeFileSync(path.join(root, "package.json"), '{"version":"1.6.2"}');
  fs.writeFileSync(path.join(root, "README.md"), "fixture\n");
  const writeCommand = (name, text) => {
    fs.writeFileSync(path.join(bin, name), `#!/bin/bash\nset -eu\n${text}\n`, {
      mode: 0o755,
    });
  };
  const runner = `
if [[ "\${1:-}" == "--version" ]]; then echo 'fixture 1.0'; exit; fi
if [[ "\${FAIL_RUNTIME:-0}" == 1 ]]; then exit 42; fi
wasm="\${!#}"
name="\${wasm##*/}"
name="\${name%%.*}"
for suffix in pretty.deserialize min.deserialize min.serialize; do
  printf '__AS_BENCH_JSON__build/logs/as/naive/%s-%s.as.json\\t%s\\n' "$name" "$suffix" '${result}'
done`;
  writeCommand("runtime-fixture", runner);
  writeCommand("wasmtime", runner);
  writeCommand(
    "go",
    `
if [[ "$1" == version ]]; then echo 'go fixture'; exit; fi
while [[ "$1" != "-o" ]]; do shift; done
cp "$FIXTURE_ROOT/bin/runtime-fixture" "$2"`,
  );
  writeCommand("npx", "exit 0");
  writeCommand(
    "git",
    `
case "$*" in
  'rev-parse HEAD') echo 0123456789abcdef ;;
  'rev-parse --abbrev-ref HEAD') echo original-branch ;;
  'rev-parse --short HEAD') echo 0123456 ;;
  'status --porcelain') echo ' M fixture.ts' ;;
  'show-ref --verify --quiet refs/remotes/origin/docs') exit 1 ;;
  'diff --cached --quiet') exit 1 ;;
  'push origin docs') echo "$PWD" > "$FIXTURE_ROOT/published-dir" ;;
esac`,
  );
  const env = { ...process.env, PATH: bin, FIXTURE_ROOT: root };
  delete env.JSON_RUNTIME_RUN;
  delete env.PUBLISH_REQUIRE_CLEAN;
  return {
    root,
    bin,
    env,
    writeCommand,
    run: () =>
      execFileSync("/bin/bash", ["scripts/run-bench.runtimes.sh"], {
        cwd: root,
        env,
        stdio: "pipe",
      }),
  };
}

test("a fresh run omits an absent engine instead of reusing prior or legacy logs", (t) => {
  const f = fixture(t);
  f.run();
  const first = readRuntimeRun(f.root);
  assert.deepEqual(first.manifest.runtimes, ["wago", "wasmtime"]);
  const firstDir = path.join(
    f.root,
    "build/logs/runtimes/runs",
    first.manifest.id,
  );
  const legacy = path.join(f.root, "build/logs/runtimes/wasmtime");
  fs.mkdirSync(legacy);
  fs.writeFileSync(
    path.join(legacy, "twitter-min.deserialize.json"),
    '{"mbps":999999,"bytes":4096}',
  );
  fs.unlinkSync(path.join(f.bin, "wasmtime"));
  f.run();
  const second = readRuntimeRun(f.root);
  assert.notEqual(second.manifest.id, first.manifest.id);
  assert.deepEqual(second.manifest.runtimes, ["wago"]);
  assert.deepEqual(Object.keys(second.results), ["wago"]);
  assert.equal(second.results.wasmtime, undefined);
  assert.equal(second.results.wago.twitter.deserialize.mbps, 123);
  assert.ok(
    fs.existsSync(path.join(firstDir, "wasmtime/twitter-min.deserialize.json")),
  );
  assert.deepEqual(readRuntimeRun(f.root, first.manifest.id), first);
  // Even an unlisted file inside the run is not a chart input.
  fs.cpSync(
    legacy,
    path.join(
      f.root,
      "build/logs/runtimes/runs",
      second.manifest.id,
      "wasmtime",
    ),
    { recursive: true },
  );
  assert.equal(readRuntimeRun(f.root).results.wasmtime, undefined);
});

test("failed attempts cannot fall back to a prior completed run", (t) => {
  const f = fixture(t);
  f.run();
  const first = readRuntimeRun(f.root);
  f.env.FAIL_RUNTIME = "1";
  assert.throws(f.run);
  assert.throws(() => readRuntimeRun(f.root), /failed, not complete/);
  assert.deepEqual(readRuntimeRun(f.root, first.manifest.id), first);
});

test("legacy logs alone and malformed selected results are rejected", (t) => {
  const f = fixture(t);
  assert.throws(() => readRuntimeRun(f.root), /No runtime run manifest/);
  assert.throws(() => readRuntimeRun(f.root, "../other"), /Invalid.*ID/);
  f.run();
  const { manifest } = readRuntimeRun(f.root);
  const file = path.join(
    f.root,
    "build/logs/runtimes/runs",
    manifest.id,
    "wago/twitter-min.deserialize.json",
  );
  fs.writeFileSync(file, '{"mbps":0,"bytes":4096}');
  assert.throws(
    () => readRuntimeRun(f.root),
    /Invalid runtime benchmark result/,
  );
  fs.unlinkSync(file);
  assert.throws(() => readRuntimeRun(f.root), /ENOENT/);
});

test("--no-run retains original provenance and publishes into the recorded version", (t) => {
  const f = fixture(t);
  f.run();
  const before = readRuntimeRun(f.root);
  const originalSubtitle = runtimeRunSubtitle(before.manifest);
  fs.writeFileSync(path.join(f.root, "package.json"), '{"version":"9.9.9"}');
  fs.writeFileSync(
    path.join(f.root, "bench/runners/wago/go.mod"),
    "changed dependencies\n",
  );
  f.writeCommand("go", "exit 99");
  f.writeCommand("npx", "exit 99");
  f.writeCommand(
    "bun",
    `node --input-type=module <<'JS'
import fs from 'node:fs';
import { readRuntimeRun, runtimeRunSubtitle } from './scripts/lib/runtime-bench-run.mjs';
const { manifest, results } = readRuntimeRun(process.cwd(), process.env.JSON_RUNTIME_RUN);
fs.mkdirSync('build/charts', { recursive: true });
for (const kind of ['deserialize', 'serialize']) {
  for (const ext of ['svg', 'png']) fs.writeFileSync('build/charts/runtimes-' + kind + '.' + ext, runtimeRunSubtitle(manifest));
}
fs.writeFileSync('build/charts/runtimes-results.json', JSON.stringify({ manifest, results }));
JS`,
  );
  execFileSync(
    "/bin/bash",
    [
      "scripts/publish-benchmarks.sh",
      "--runtimes",
      "--no-run",
      "--run",
      before.manifest.id,
    ],
    { cwd: f.root, env: f.env, stdio: "pipe" },
  );
  assert.deepEqual(readRuntimeRun(f.root, before.manifest.id), before);
  assert.equal(
    fs.readFileSync(
      path.join(f.root, "build/charts/runtimes-deserialize.svg"),
      "utf8",
    ),
    originalSubtitle,
  );
  const exported = JSON.parse(
    fs.readFileSync(
      path.join(f.root, "build/charts/runtimes-results.json"),
      "utf8",
    ),
  );
  assert.deepEqual(exported.manifest, before.manifest);
  const publishedDir = fs
    .readFileSync(path.join(f.root, "published-dir"), "utf8")
    .trim();
  // Fake git leaves the temporary worktree for inspection; cleanup still runs.
  t.after(() => fs.rmSync(publishedDir, { recursive: true, force: true }));
  assert.ok(
    fs.existsSync(
      path.join(publishedDir, "charts/v1.6.2/runtimes-results.json"),
    ),
  );
  assert.ok(!fs.existsSync(path.join(publishedDir, "charts/v9.9.9")));
});

test("chart configuration uses only the selected run and original subtitle", (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.bin, "wasmtime"));
  f.run();
  const selected = readRuntimeRun(f.root);
  // The current checkout metadata is deliberately unavailable when rendering.
  fs.unlinkSync(path.join(f.root, "package.json"));
  fs.unlinkSync(path.join(f.root, "bench/runners/wago/go.mod"));
  f.writeCommand("git", "exit 99");
  const renderer = path.join(f.root, "renderer");
  for (const file of [
    "scripts/build-chart-runtimes.ts",
    "scripts/lib/bench-utils.ts",
    "scripts/lib/palette.ts",
    "scripts/lib/chart-outliers.ts",
  ]) {
    let source = fs.readFileSync(path.join(repo, file), "utf8");
    source = source.replace(/from "(\.[^"]+)"/g, (all, target) =>
      target.endsWith(".mjs") ? all : `from "${target}.mjs"`,
    );
    source = source.replace(
      'from "chartjs-node-canvas"',
      'from "./canvas-fixture.mjs"',
    );
    const target = path.join(renderer, file.replace(/\.ts$/, ".mjs"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    );
  }
  fs.copyFileSync(
    path.join(repo, "scripts/lib/runtime-bench-run.mjs"),
    path.join(renderer, "scripts/lib/runtime-bench-run.mjs"),
  );
  // Capture the actual chart configuration, without a native canvas dependency.
  fs.writeFileSync(
    path.join(renderer, "scripts/lib/canvas-fixture.mjs"),
    `
export class ChartJSNodeCanvas {
  renderToBufferSync(config) { return Buffer.from(JSON.stringify(config)); }
}`,
  );
  execFileSync(
    process.execPath,
    [
      path.join(renderer, "scripts/build-chart-runtimes.mjs"),
      "--run",
      selected.manifest.id,
    ],
    { cwd: f.root, env: f.env, stdio: "pipe" },
  );
  for (const kind of ["deserialize", "serialize"]) {
    for (const ext of ["svg", "png"]) {
      const config = JSON.parse(
        fs.readFileSync(
          path.join(f.root, `build/charts/runtimes-${kind}.${ext}`),
          "utf8",
        ),
      );
      assert.equal(config.data.datasets.length, 1);
      assert.equal(config.data.datasets[0].label, "Wago");
      assert.deepEqual(config.data.datasets[0].data, [123, 123, 123]);
      assert.equal(
        config.options.plugins.subtitle.text,
        runtimeRunSubtitle(selected.manifest),
      );
    }
  }
  const exported = JSON.parse(
    fs.readFileSync(
      path.join(f.root, "build/charts/runtimes-results.json"),
      "utf8",
    ),
  );
  assert.deepEqual(exported.manifest, selected.manifest);
  assert.deepEqual(exported.results, selected.results);
});
