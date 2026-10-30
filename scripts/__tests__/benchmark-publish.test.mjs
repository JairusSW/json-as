import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

function writeExecutable(file, body) {
  fs.writeFileSync(file, `#!/bin/bash\nset -euo pipefail\n${body}\n`);
  fs.chmodSync(file, 0o755);
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
