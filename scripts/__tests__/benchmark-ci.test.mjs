// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

test("CI runs the complete benchmark-tooling regression suite", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
  assert.equal(
    pkg.scripts["test:bench"],
    "node --test scripts/__tests__/*.test.mjs",
  );

  for (const workflow of ["tests.yml", "release.yml"]) {
    const source = fs.readFileSync(
      path.join(root, ".github", "workflows", workflow),
      "utf8",
    );
    assert.match(
      source,
      /run: bun run test:bench\s*$/m,
      `${workflow} must run the aggregate benchmark-tooling suite`,
    );
  }
});
