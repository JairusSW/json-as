import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

test("CI installs exactly the dependency graph from package-lock.json", () => {
  for (const workflow of ["tests.yml", "release.yml", "lint.yml"]) {
    const source = fs.readFileSync(
      path.join(root, ".github", "workflows", workflow),
      "utf8",
    );
    assert.doesNotMatch(source, /run: bun install\s*$/m);
    assert.match(
      source,
      /run: npm ci\s*$/m,
      `${workflow} must use the committed npm lockfile`,
    );
    assert.doesNotMatch(
      source,
      /continue-on-error:\s*true/,
      `${workflow} must not turn a failed quality gate green`,
    );
  }
});
