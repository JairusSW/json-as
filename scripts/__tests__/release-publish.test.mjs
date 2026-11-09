import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
const root = path.resolve(import.meta.dirname, "../..");
test("publish prompts work on the system Bash, including uppercase replies", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-publish-helper-"));
  try {
    fs.mkdirSync(path.join(dir, "scripts"));
    fs.mkdirSync(path.join(dir, "bin"));
    fs.copyFileSync(
      path.join(root, "scripts/publish.sh"),
      path.join(dir, "scripts/publish.sh"),
    );
    const npm = path.join(dir, "bin/npm"),
      log = path.join(dir, "npm.log");
    fs.writeFileSync(
      npm,
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$PUBLISH_PROBE_LOG"\n',
      { mode: 0o755 },
    );
    for (const [version, input, wanted] of [
      ["2.0.0", "N\nNO\n", ["run build:transform", "run test"]],
      ["2.0.0", "YES\nN\n", ["run build:transform", "run format", "run test"]],
      [
        "2.0.0-preview.1",
        "n\ny\n",
        [
          "run build:transform",
          "run test",
          "publish --tag preview",
          "dist-tag rm json-as alpha",
          "dist-tag rm json-as beta",
        ],
      ],
      [
        "2.0.0",
        "n\ny\n",
        [
          "run build:transform",
          "run test",
          "publish --tag latest",
          "dist-tag rm json-as alpha",
          "dist-tag rm json-as beta",
        ],
      ],
    ]) {
      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ version }),
      );
      fs.writeFileSync(log, "");
      const result = spawnSync(
        "/bin/bash",
        [path.join(dir, "scripts/publish.sh")],
        {
          input,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: path.join(dir, "bin") + path.delimiter + process.env.PATH,
            PUBLISH_PROBE_LOG: log,
          },
        },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), wanted);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("GitHub release classification includes every supported preview tag", () => {
  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/release.yml"),
    "utf8",
  );
  const expression = workflow.match(/prerelease:\s*\$\{\{([^\n]+)\}\}/)?.[1];
  assert(expression);
  const calls = [...expression.matchAll(/contains\(github\.ref, '([^']+)'\)/g)];
  assert.match(
    expression.replace(/contains\(github\.ref, '[^']+'\)/g, "flag").trim(),
    /^flag(?:\s*\|\|\s*flag)*$/,
  );
  const classify = (tag) => calls.some(([, part]) => tag.includes(part));
  for (const tag of [
    "v2.0.0-alpha.1",
    "v2.0.0-beta.1",
    "v2.0.0-rc.1",
    "v2.0.0-preview.1",
  ])
    assert(classify(tag), tag);
  assert(!classify("v2.0.0"));
});
