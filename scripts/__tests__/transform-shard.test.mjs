import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { transformTests, selectShard } from "../run-transform-shard.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const command = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
).scripts["test:transform"];

test("CI shards execute every canonical transform test exactly once", () => {
  const tests = transformTests(command);
  for (const file of tests) assert(fs.existsSync(path.join(root, file)), file);
  for (let count = 1; count <= 8; count++) {
    const shards = Array.from({ length: count }, (_, index) =>
      selectShard(tests, index, count),
    );
    assert.deepEqual(shards.flat().sort(), [...tests].sort());
    assert.equal(new Set(shards.flat()).size, tests.length);
    for (const shard of shards)
      assert.deepEqual(
        shard,
        tests.filter((file) => shard.includes(file)),
      );
  }
  for (const [index, count] of [
    [0, 0],
    [-1, 8],
    [8, 8],
    [0, 1.5],
    [NaN, 8],
  ])
    assert.throws(() => selectShard(tests, index, count));
  assert.throws(() => transformTests("node a.mjs"));
  assert.throws(() =>
    transformTests("node transform/__tests__/one.test.mjs && echo skipped"),
  );
  assert.throws(() =>
    transformTests(
      "node transform/__tests__/one.test.mjs && node transform/__tests__/one.test.mjs",
    ),
  );
});

test("shards preserve fail-fast command execution and exit status", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-test-shard-"));
  try {
    fs.mkdirSync(path.join(dir, "transform/__tests__"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({
        scripts: {
          "test:transform":
            "node transform/__tests__/one.test.mjs && node transform/__tests__/two.test.mjs",
        },
      }),
    );
    const marker = path.join(dir, "executed");
    const one = path.join(dir, "transform/__tests__/one.test.mjs");
    const two = path.join(dir, "transform/__tests__/two.test.mjs");
    fs.writeFileSync(
      one,
      `import fs from 'node:fs';fs.appendFileSync(${JSON.stringify(marker)},'1');process.exit(7);`,
    );
    fs.writeFileSync(
      two,
      `import fs from 'node:fs';fs.appendFileSync(${JSON.stringify(marker)},'2');`,
    );
    const source = `import {runShard} from ${JSON.stringify(pathToFileURL(path.join(root, "scripts/run-transform-shard.mjs")).href)};process.exitCode=runShard(${JSON.stringify(dir)},0,1);`;
    const run = () =>
      spawnSync(process.execPath, ["--input-type=module", "-e", source], {
        encoding: "utf8",
      });
    assert.equal(run().status, 7);
    assert.equal(fs.readFileSync(marker, "utf8"), "1");
    fs.writeFileSync(marker, "");
    fs.writeFileSync(
      one,
      `import fs from 'node:fs';fs.appendFileSync(${JSON.stringify(marker)},'1');`,
    );
    assert.equal(run().status, 0);
    assert.equal(fs.readFileSync(marker, "utf8"), "12");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("main and release CI retain every runtime and package gate", () => {
  for (const file of ["tests.yml", "release.yml"]) {
    const source = fs.readFileSync(
      path.join(root, ".github/workflows", file),
      "utf8",
    );
    assert.match(source, /shard: \[0, 1, 2, 3, 4, 5, 6, 7\]/);
    assert.match(source, /fail-fast: false/);
    assert(
      source.includes("set -euo pipefail"),
      `${file}: installer fail-fast`,
    );
    assert(
      source.includes(
        'bash "$RUNNER_TEMP/install-wasmtime.sh" --version v50.0.1',
      ),
      `${file}: tested Wasmtime version`,
    );
    assert(
      source.includes('"$HOME/.wasmtime/bin/wasmtime" --version'),
      `${file}: verify installed runtime before tests`,
    );
    assert.match(
      source,
      /- name: Test Transform\n {8}run: node scripts\/run-transform-shard\.mjs \$\{\{ matrix\.shard \}\} 8/,
    );
    for (const [name, index] of Object.entries({
      "Test pnpm Packed Consumers": 0,
      "Test Packed Consumer": 0,
      "Run Tests (Slow)": 1,
      "Run Tests (Fast)": 2,
      "Run Strict Public Tests (Slow)": 3,
      "Run Strict Tests (Fast)": 4,
    }))
      assert(
        source.includes(
          `- name: ${name}\n        if: matrix.shard == ${index}\n`,
        ),
        `${file}: ${name}`,
      );
    for (const code of [
      "JSON_USE_FAST_PATH=0 bun run test:ci -- --no-cache",
      "JSON_USE_FAST_PATH=1 bun run test:ci -- --no-cache",
      "JSON_USE_FAST_PATH=0 bun run test:rfc:public -- --no-cache",
      "JSON_USE_FAST_PATH=1 bun run test:rfc -- --no-cache",
    ])
      assert(source.includes(code), `${file}: ${code}`);
  }
  const packed = fs.readFileSync(
    path.join(root, "transform/__tests__/packed-consumer.test.mjs"),
    "utf8",
  );
  assert(packed.includes('"--prefer-offline"'));
  assert(!packed.includes('"--offline"'));
});
