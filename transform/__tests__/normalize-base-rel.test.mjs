// Regression test for the path-rewrite in `normalizeJsonAsBaseRel`.
//
// Each case is a relative path that the transform might compute from a
// user source file back to the json-as package root. The expected output
// is the bare specifier that should appear in emitted runtime imports.
//
// The pnpm case is the original bug (json-as@1.3.6+):
//   `indexOf("json-as")` matched the store directory `json-as@<ver>_<hash>`
//   instead of the trailing leaf segment, leaking the virtual-store name
//   into every emitted import. `lastIndexOf` fixes it for every layout
//   without regressing the flat-npm path.
//
// Run with: `node transform/__tests__/normalize-base-rel.test.mjs`
// (no dependencies beyond Node's built-in `assert`).

import assert from "node:assert/strict";
import { normalizeJsonAsBaseRel } from "../lib/index.js";

const cases = [
  // [input, expected, label]
  ["../../node_modules/json-as", "json-as", "flat npm"],
  [
    "../../.pnpm/json-as@1.3.6_assemblyscript@0.28.17/node_modules/json-as",
    "json-as",
    "pnpm with version+hash",
  ],
  [
    "../../../.pnpm/json-as@1.3.7/node_modules/json-as",
    "json-as",
    "pnpm with version only",
  ],
  [
    "../../../some/nested/workspace/node_modules/json-as",
    "json-as",
    "nested workspace",
  ],
  // Already-bare specifier (transform-internal callers): pass through.
  ["json-as", "json-as", "already-bare specifier"],
  // Already-bare nested: not the leaf case; left as `./...`.
  ["assembly/util/atoi", "./assembly/util/atoi", "non-json-as relative"],
  // Absolute path: untouched.
  ["/abs/path/json-as", "json-as", "absolute path with trailing json-as"],
  // Path that *contains* `json-as` but not as the trailing segment.
  // Should NOT enter the rewrite branch (endsWith check guards it).
  [
    "./json-as/something/else",
    "./json-as/something/else",
    "json-as not at the leaf",
  ],
];

let failed = 0;
for (const [input, expected, label] of cases) {
  const actual = normalizeJsonAsBaseRel(input);
  try {
    assert.equal(actual, expected, `${label}: ${input}`);
    console.log(`  ✓ ${label}`);
  } catch {
    console.error(`  ✗ ${label}`);
    console.error(`      input:    ${input}`);
    console.error(`      expected: ${expected}`);
    console.error(`      actual:   ${actual}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} cases passed.`);
