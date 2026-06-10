// Tests for `computeImportBaseRel` - the relative-specifier computation the
// transform uses to point a user module's emitted runtime imports back at the
// json-as package root.
//
// Two things must hold regardless of host OS:
//   1. Cross-platform: Windows (`\`) and POSIX (`/`) layouts must produce the
//      SAME forward-slash specifier. We exercise both via `path.win32` /
//      `path.posix` so a Linux/mac CI run still covers the Windows path logic.
//   2. Through symlinks (pnpm/yarn-pnp): Node realpath-resolves
//      `import.meta.url`, so the package root the transform sees is the real
//      `.pnpm/.../node_modules/json-as` dir. The trailing-`json-as` collapse
//      must still yield the bare `json-as` specifier (which AS then resolves
//      through the consumer's node_modules symlink). A real on-disk symlink
//      exercises this end-to-end.
//
// Run with: `node transform/__tests__/compute-base-rel.test.mjs`

import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { computeImportBaseRel } from "../lib/index.js";

let failed = 0;
function check(label, actual, expected) {
  try {
    assert.equal(actual, expected, label);
    console.log(`  ✓ ${label}`);
  } catch {
    console.error(
      `  ✗ ${label}\n      expected: ${expected}\n      actual:   ${actual}`,
    );
    failed++;
  }
}

// --- Cross-platform layout cases. Each gives the consumer's source dir and the
// resolved json-as package dir in BOTH posix and win32 form; both must collapse
// to the same forward-slash specifier. ---
const layouts = [
  {
    label: "flat npm (consumer)",
    posix: ["/proj/assembly", "/proj/node_modules/json-as"],
    win32: ["C:\\proj\\assembly", "C:\\proj\\node_modules\\json-as"],
    expected: "json-as",
  },
  {
    label: "pnpm store (version+hash, realpath-resolved)",
    posix: [
      "/proj/assembly",
      "/proj/node_modules/.pnpm/json-as@1.3.7_assemblyscript@0.28.17/node_modules/json-as",
    ],
    win32: [
      "C:\\proj\\assembly",
      "C:\\proj\\node_modules\\.pnpm\\json-as@1.3.7_assemblyscript@0.28.17\\node_modules\\json-as",
    ],
    expected: "json-as",
  },
  {
    label: "pnpm store (--preserve-symlinks, unresolved leaf)",
    posix: ["/proj/src", "/proj/node_modules/json-as"],
    win32: ["C:\\proj\\src", "C:\\proj\\node_modules\\json-as"],
    expected: "json-as",
  },
  {
    label: "nested workspace consumer",
    posix: ["/proj/packages/app/src", "/proj/node_modules/json-as"],
    win32: ["C:\\proj\\packages\\app\\src", "C:\\proj\\node_modules\\json-as"],
    expected: "json-as",
  },
  {
    label: "in-repo (package dir IS the repo root → relative)",
    posix: ["/work/json-as/assembly/__benches__", "/work/json-as"],
    win32: ["C:\\work\\json-as\\assembly\\__benches__", "C:\\work\\json-as"],
    expected: "../..",
  },
];

for (const { label, posix, win32, expected } of layouts) {
  const pOut = computeImportBaseRel(posix[0], posix[1], path.posix);
  const wOut = computeImportBaseRel(win32[0], win32[1], path.win32);
  check(`${label} [posix]`, pOut, expected);
  check(`${label} [win32]`, wOut, expected);
  // Cross-platform invariant: identical, forward-slash output on both.
  check(`${label} [win32 == posix]`, wOut, pOut);
  assert.ok(
    !wOut.includes("\\"),
    `${label}: win32 output must not contain backslashes (got ${wOut})`,
  );
}

// --- Real on-disk symlink (pnpm-style). Skips gracefully where symlinks aren't
// permitted (e.g. Windows without privilege). ---
{
  const label = "real symlink (pnpm layout)";
  let tmp;
  try {
    // realpath the tmp root up front so macOS /tmp -> /private/var doesn't skew
    // the relative computation between userDir and the realpath'd package.
    tmp = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "jsonas-sym-")),
    );
    const real = path.join(
      tmp,
      "proj/node_modules/.pnpm/json-as@1.3.7/node_modules/json-as",
    );
    fs.mkdirSync(real, { recursive: true });
    const link = path.join(tmp, "proj/node_modules/json-as");
    fs.symlinkSync(real, link, "dir");
    const userDir = path.join(tmp, "proj/assembly");
    fs.mkdirSync(userDir, { recursive: true });

    // Default Node: import.meta.url is realpath-resolved → the .pnpm store dir.
    const resolved = fs.realpathSync(link);
    check(
      `${label} [realpath-resolved]`,
      computeImportBaseRel(userDir, resolved),
      "json-as",
    );
    // --preserve-symlinks: the leaf symlink path itself.
    check(
      `${label} [unresolved leaf]`,
      computeImportBaseRel(userDir, link),
      "json-as",
    );
  } catch (err) {
    if (err && (err.code === "EPERM" || err.code === "EACCES")) {
      console.log(`  ~ ${label} (skipped: symlinks not permitted here)`);
    } else {
      console.error(`  ✗ ${label}: ${err && err.message}`);
      failed++;
    }
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed.`);
  process.exit(1);
}
console.log("\nAll compute-base-rel cases passed.");
