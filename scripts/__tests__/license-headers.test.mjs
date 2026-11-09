// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import {
  addNotice,
  styleFor,
  processFiles,
  trackedFiles,
} from "../license-headers.mjs";

const root = path.resolve(import.meta.dirname, "../..");

test("source notices preserve code, shebangs and Python encodings", () => {
  for (const [text, style, prefix] of [
    ["export const value = 7;\n", "//", ""],
    ["#!/bin/bash\nset -e\n", "#", "#!/bin/bash\n"],
    [
      "#!/usr/bin/env python3\n# coding: utf-8\nprint(7)\n",
      "#",
      "#!/usr/bin/env python3\n# coding: utf-8\n",
    ],
    ['const text = "SPDX-License-Identifier: MPL-2.0";\n', "//", ""],
    ["", "//", ""],
  ]) {
    const result = addNotice(text, style);
    assert(result.startsWith(prefix));
    assert(result.endsWith(text.slice(prefix.length)));
    assert.equal(addNotice(result, style), result);
    assert(result.includes("SPDX-License-Identifier: MPL-2.0"));
  }
  assert.throws(
    () => addNotice("// SPDX-License-Identifier: Apache-2.0\n", "//"),
    /Refusing/,
  );
  assert.throws(
    () => addNotice("const n = 1;\n" + addNotice("", "//"), "//"),
    /misplaced/,
  );
  assert.equal(styleFor("example.ts.disabled"), "//");
  assert.equal(styleFor(".github/workflows/test.yml"), "#");
  assert.equal(styleFor(".husky/pre-commit"), "#");
});

test("non-code files stay unchanged and do not need sidecars", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-license-config-"));
  try {
    for (const file of [
      "package.json",
      ".prettierrc.json",
      "README.md",
      "go.mod",
    ]) {
      const content = file.endsWith(".json")
        ? '{"valid":true}\n'
        : "metadata\n";
      fs.writeFileSync(path.join(dir, file), content);
      assert.equal(styleFor(file), null);
      assert.equal(processFiles(dir, [file], true).checked, 0);
      assert.equal(fs.readFileSync(path.join(dir, file), "utf8"), content);
      assert(!fs.existsSync(path.join(dir, file + ".license")));
    }
    assert.equal(styleFor(".github/dependabot.yml"), null);
    assert.equal(
      styleFor("assembly/__benches__/payloads/twitter.min.json"),
      null,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test(
  "prepublish lifecycle blocks missing headers and permits correctly licensed code",
  { timeout: 60000 },
  () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "json-as-license-publish-"),
    );
    try {
      fs.mkdirSync(path.join(dir, "scripts"));
      fs.copyFileSync(
        path.join(root, "scripts/license-headers.mjs"),
        path.join(dir, "scripts/license-headers.mjs"),
      );
      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({
          name: "json-as-license-hook-fixture",
          version: "0.0.0",
          type: "module",
          license: "MPL-2.0",
          scripts: {
            prepublishOnly: "node scripts/license-headers.mjs --check",
          },
        }),
      );
      fs.writeFileSync(path.join(dir, "index.js"), "export const value = 7;\n");
      execFileSync("git", ["init", "-q"], { cwd: dir });
      const publish = () =>
        spawnSync("npm", ["publish", "--dry-run", "--offline"], {
          cwd: dir,
          encoding: "utf8",
        });
      const blocked = publish();
      assert.notEqual(blocked.status, 0);
      assert.match(blocked.stdout + blocked.stderr, /Missing MPL-2.0 notices/);
      fs.writeFileSync(
        path.join(dir, "index.js"),
        addNotice("export const value = 7;\n", "//"),
      );
      const allowed = publish();
      assert.equal(allowed.status, 0, allowed.stdout + allowed.stderr);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

test("source audit, publish hook and dedicated CI gate stay in sync", () => {
  const result = processFiles(root, trackedFiles(root));
  assert.deepEqual(result.missing, []);
  assert.equal(result.preserved, 2);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
  const lock = JSON.parse(
    fs.readFileSync(path.join(root, "package-lock.json")),
  );
  assert.equal(pkg.license, "MPL-2.0");
  assert.equal(lock.packages[""].license, "MPL-2.0");
  assert.equal(pkg.scripts.prepublishOnly, "npm run license:check");
  assert(pkg.files.includes("NOTICE"));
  assert(!pkg.files.includes("THIRD_PARTY_NOTICES.md"));
  assert(
    fs.readFileSync(path.join(root, "NOTICE"), "utf8").includes("Hypermode"),
  );
  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/license.yml"),
    "utf8",
  );
  assert(workflow.includes("on: [push, pull_request]"));
  assert(workflow.includes("run: npm run license:check"));
});
