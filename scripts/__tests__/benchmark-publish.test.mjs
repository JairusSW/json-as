import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

function writeExecutable(file, body) {
  fs.writeFileSync(file, `#!/bin/bash\nset -euo pipefail\n${body}\n`);
  fs.chmodSync(file, 0o755);
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" });
}

test("a full publication refreshes the full benchmark matrix", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-publish-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.mkdirSync(path.join(root, "scripts", "__tests__"), { recursive: true });
  fs.copyFileSync(
    path.join(repositoryRoot, "scripts", "publish-benchmarks.sh"),
    path.join(root, "scripts", "publish-benchmarks.sh"),
  );
  fs.writeFileSync(path.join(root, "package.json"), '{"version":"1.7.0"}\n');
  fs.writeFileSync(path.join(root, "README.md"), "fixture\n");

  for (const command of [
    "bench-all.sh",
    "run-bench.as.sh",
    "run-bench.js.sh",
  ]) {
    writeExecutable(
      path.join(root, "scripts", command),
      `printf '%s\\n' '${command}' >> "$PWD/calls.log"`,
    );
  }
  writeExecutable(
    path.join(root, "scripts", "build-charts.sh"),
    `printf '%s\\n' 'build-charts.sh' >> "$PWD/calls.log"\nexit 91`,
  );

  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  const result = spawnSync("bash", ["scripts/publish-benchmarks.sh"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 91, result.stderr || result.stdout);
  assert.deepEqual(
    fs.readFileSync(path.join(root, "calls.log"), "utf8").trim().split("\n"),
    ["bench-all.sh", "build-charts.sh"],
  );
});

test("a regular publication preserves provenance-pinned runtime charts", (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-publish-git-"));
  const root = path.join(base, "repo");
  const remote = path.join(base, "origin.git");
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));

  fs.copyFileSync(
    path.join(repositoryRoot, "scripts", "publish-benchmarks.sh"),
    path.join(root, "scripts", "publish-benchmarks.sh"),
  );
  fs.writeFileSync(path.join(root, "package.json"), '{"version":"1.7.0"}\n');
  fs.writeFileSync(path.join(root, "README.md"), "fixture\n");
  writeExecutable(
    path.join(root, "scripts", "bench-all.sh"),
    `printf '%s\\n' 'bench-all.sh' >> "$PWD/calls.log"`,
  );
  writeExecutable(
    path.join(root, "scripts", "build-charts.sh"),
    `mkdir -p build/charts
printf '%s\\n' 'new regular chart' > build/charts/regular.svg
printf '%s\\n' 'stale local runtime chart' > build/charts/runtimes-deserialize.svg
printf '%s\\n' 'stale local runtime chart' > build/charts/runtimes-serialize.svg
printf '%s\\n' '{"manifest":"stale local runtime run"}' > build/charts/runtimes-results.json`,
  );

  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "json-as test");
  git(root, "config", "user.email", "json-as-test@example.com");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture main");

  git(root, "switch", "-q", "--orphan", "docs");
  const chartDir = path.join(root, "charts", "v1.7.0");
  fs.mkdirSync(chartDir, { recursive: true });
  for (const file of [
    "runtimes-deserialize.svg",
    "runtimes-serialize.svg",
    "runtimes-results.json",
  ]) {
    fs.writeFileSync(path.join(chartDir, file), "pinned runtime artifact\n");
  }
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture docs");
  git(root, "switch", "-q", "main");

  git(base, "init", "-q", "--bare", remote);
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-q", "origin", "main", "docs");

  execFileSync("bash", ["scripts/publish-benchmarks.sh"], {
    cwd: root,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "json-as test",
      GIT_AUTHOR_EMAIL: "json-as-test@example.com",
    },
    stdio: "pipe",
  });

  assert.equal(
    git(base, "--git-dir", remote, "show", "docs:charts/v1.7.0/regular.svg"),
    "new regular chart\n",
  );
  for (const file of [
    "runtimes-deserialize.svg",
    "runtimes-serialize.svg",
    "runtimes-results.json",
  ]) {
    assert.equal(
      git(base, "--git-dir", remote, "show", `docs:charts/v1.7.0/${file}`),
      "pinned runtime artifact\n",
    );
  }
});
