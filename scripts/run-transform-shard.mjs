import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function transformTests(command) {
  const tests = command.split("&&").map((part) => {
    const match = part
      .trim()
      .match(/^node (transform\/__tests__\/[A-Za-z0-9_-]+\.test\.mjs)$/);
    assert(match, `Unsupported transform test command: ${part}`);
    return match[1];
  });
  assert.equal(
    new Set(tests).size,
    tests.length,
    "Duplicate transform test command",
  );
  return tests;
}

export function selectShard(tests, index, count) {
  assert(
    Number.isInteger(count) && count > 0 && count <= tests.length,
    "Invalid shard count",
  );
  assert(
    Number.isInteger(index) && index >= 0 && index < count,
    "Invalid shard index",
  );
  return tests.filter((_, position) => position % count === index);
}

export function runShard(root, index, count) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const tests = selectShard(
    transformTests(pkg.scripts["test:transform"]),
    index,
    count,
  );
  console.log(`Transform shard ${index + 1}/${count}: ${tests.length} tests`);
  for (const file of tests) {
    console.log(`Running ${file}`);
    const result = spawnSync(process.execPath, [file], {
      cwd: root,
      stdio: "inherit",
    });
    if (result.error) console.error(result.error.message);
    if (result.status !== 0) return result.status || 1;
  }
  return 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert.equal(
    process.argv.length,
    4,
    "Usage: node scripts/run-transform-shard.mjs <zero-based index> <count>",
  );
  process.exitCode = runShard(
    path.resolve(import.meta.dirname, ".."),
    Number(process.argv[2]),
    Number(process.argv[3]),
  );
}
