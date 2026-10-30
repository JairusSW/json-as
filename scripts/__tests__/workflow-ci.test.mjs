import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

test("CI installs exactly the dependency graph from package-lock.json", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const packageLock = JSON.parse(
    fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
  );
  const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");

  assert.doesNotMatch(
    gitignore,
    /^package-lock\.json$/m,
    "package-lock.json must be committed for npm ci",
  );
  assert.equal(
    packageLock.packages[""].version,
    packageJson.version,
    "package-lock.json must describe the release package version",
  );

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

test("release tags must match the package version", () => {
  const release = fs.readFileSync(
    path.join(root, ".github", "workflows", "release.yml"),
    "utf8",
  );

  assert.match(
    release,
    /test "v\$\(node -p "require\('\.\/package\.json'\)\.version"\)" = "\$GITHUB_REF_NAME"/,
  );
});
