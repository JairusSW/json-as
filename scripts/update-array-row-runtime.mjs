// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// Regenerate only after reviewing changes to these callback-free dependencies.
// A changed compiler/runtime otherwise safely disables borrowed row traversal.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import asc from "assemblyscript/asc";
import { Transform } from "assemblyscript/transform";
import "../transform/lib/index.js";
import { arrayRowAstFingerprint } from "../transform/lib/array-row-safety.js";
import { ARRAY_ROW_SOURCES } from "../transform/lib/array-row-runtime.js";

const entries = [];
class Inspect extends Transform {
  afterParse(parser) {
    for (const key of ARRAY_ROW_SOURCES.keys()) {
      const internalPath = key.replace(/^own:/, "");
      const source = parser.sources.find(
        (input) => input.internalPath === internalPath,
      );
      assert.ok(source, `Missing reviewed source ${key}`);
      entries.push([
        key,
        [
          createHash("sha256").update(source.text).digest("hex"),
          arrayRowAstFingerprint(source.statements),
        ],
      ]);
    }
    throw Error("ARRAY_ROW_MANIFEST_COMPLETE");
  }
}
const result = await asc.main(
  ["assembly/__tests__/array-row.fixture.ts", "--noEmit"],
  { transforms: [Inspect] },
);
assert.match(String(result.error), /ARRAY_ROW_MANIFEST_COMPLETE/);
const changed = entries.filter(([key, actual]) => {
  const expected = ARRAY_ROW_SOURCES.get(key);
  return !expected || actual.some((value, index) => value !== expected[index]);
});
if (process.argv.includes("--check")) {
  if (changed.length) {
    console.error("Reviewed runtime fingerprints are stale:");
    for (const [key] of changed) console.error(`  ${key}`);
    console.error(
      "Review the source changes, run node scripts/update-array-row-runtime.mjs, then npm run build:transform.",
    );
    process.exitCode = 1;
  } else
    console.log(
      `Verified ${entries.length} reviewed source and AST fingerprints.`,
    );
} else {
  const target = "transform/src/array-row-runtime.ts";
  const header = fs.readFileSync(target, "utf8").split("export const")[0];
  fs.writeFileSync(
    target,
    header +
      "export const ARRAY_ROW_SOURCES = new Map<string, readonly [string, string]>(" +
      JSON.stringify(entries, null, 2) +
      ");\n",
  );
  console.log(
    `Updated ${entries.length} reviewed source and AST fingerprints; rebuild the transform before testing.`,
  );
}
