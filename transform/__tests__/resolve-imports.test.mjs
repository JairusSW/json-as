// End-to-end resolution test: for every dev environment / package-manager
// layout, build a real on-disk tree, compute the specifiers the transform
// would emit (baseRel + each injected subpath), and assert each one resolves
// to an existing file the way the AssemblyScript loader would.
//
// The injected subpaths are the complete set the transform emits — note `bs`
// lives at `lib/as-bs` (package root), NOT under `assembly/`:
//   bs            -> lib/as-bs
//   JSON          -> assembly/index
//   atoi          -> assembly/util/atoi
//   scanValueEnd  -> assembly/deserialize/swar/array/shared
//   fieldHelpers  -> assembly/deserialize
//
// Covered: npm/yarn-classic/bun (flat hoisted), pnpm (symlinked .pnpm store),
// pnpm --preserve-symlinks (leaf), npm/yarn workspaces (hoisted + non-hoisted),
// pnpm workspaces, npm/yarn link & file: (symlink to external checkout), and
// in-repo dev (no node_modules, relative). Yarn PnP (zip, no node_modules) is
// not covered: AssemblyScript's resolver requires an on-disk node_modules, so
// PnP needs `nodeLinker: node-modules` regardless of json-as.
//
// Run with: `node transform/__tests__/resolve-imports.test.mjs`

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { computeImportBaseRel } from "../lib/index.js";

const SUBPATHS = {
  bs: ["lib", "as-bs"],
  JSON: ["assembly", "index"],
  atoi: ["assembly", "util", "atoi"],
  scanValueEnd: ["assembly", "deserialize", "swar", "array", "shared"],
  fieldHelpers: ["assembly", "deserialize"],
};

// Minimal AS-style resolver: relative specifier -> resolved against the
// importing file's dir; bare `json-as/x` -> nearest `node_modules/json-as/x`.
// Tries `.ts` and directory-`index.ts`, following symlinks via existsSync.
function resolves(fromDir, specifier) {
  const tryFile = (base) =>
    fs.existsSync(base + ".ts") ||
    (fs.existsSync(base) &&
      fs.statSync(base).isDirectory() &&
      fs.existsSync(path.join(base, "index.ts")));
  if (specifier.startsWith(".") || path.isAbsolute(specifier)) {
    return tryFile(path.resolve(fromDir, specifier));
  }
  let dir = fromDir;
  for (;;) {
    if (tryFile(path.join(dir, "node_modules", specifier))) return true;
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

// Materialize the json-as package's injected files (stubs; resolver only checks
// existence). `assembly/deserialize` is created as a directory + index.ts so the
// barrel resolves like the real layout.
function materializePkg(pkgDir) {
  for (const seg of Object.values(SUBPATHS)) {
    const last = seg[seg.length - 1];
    // `deserialize` barrel is a directory index; others are leaf .ts files.
    const file =
      last === "deserialize"
        ? path.join(pkgDir, ...seg, "index.ts")
        : path.join(pkgDir, ...seg) + ".ts";
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "// stub\n");
  }
}

const tmp = fs.realpathSync(
  fs.mkdtempSync(path.join(os.tmpdir(), "jsonas-res-")),
);
let caseId = 0;
const root = () => {
  const r = path.join(tmp, "c" + caseId++);
  fs.mkdirSync(r, { recursive: true });
  return r;
};
const mkConsumer = (file) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "// @json class X {}\n");
  return file;
};

// Each builder returns { consumerFile, pkgRoot } where pkgRoot is the package
// root the transform sees (realpath-resolved, as Node resolves import.meta.url).
const builders = [
  [
    "npm / yarn-classic / bun (flat hoisted)",
    () => {
      const r = root();
      const consumerFile = mkConsumer(path.join(r, "assembly", "m.ts"));
      const pkg = path.join(r, "node_modules", "json-as");
      materializePkg(pkg);
      return { consumerFile, pkgRoot: pkg };
    },
  ],
  [
    "pnpm (symlinked .pnpm store, realpath-resolved)",
    () => {
      const r = root();
      const consumerFile = mkConsumer(path.join(r, "assembly", "m.ts"));
      const real = path.join(
        r,
        "node_modules",
        ".pnpm",
        "json-as@1.3.7_assemblyscript@0.28.17",
        "node_modules",
        "json-as",
      );
      materializePkg(real);
      const link = path.join(r, "node_modules", "json-as");
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(real, link, "dir");
      return { consumerFile, pkgRoot: fs.realpathSync(link) };
    },
  ],
  [
    "pnpm (--preserve-symlinks, unresolved leaf)",
    () => {
      const r = root();
      const consumerFile = mkConsumer(path.join(r, "src", "m.ts"));
      const real = path.join(
        r,
        "node_modules",
        ".pnpm",
        "json-as@1.3.7",
        "node_modules",
        "json-as",
      );
      materializePkg(real);
      const link = path.join(r, "node_modules", "json-as");
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(real, link, "dir");
      return { consumerFile, pkgRoot: link }; // leaf symlink path, not resolved
    },
  ],
  [
    "workspaces hoisted (root node_modules)",
    () => {
      const r = root();
      const consumerFile = mkConsumer(
        path.join(r, "packages", "app", "src", "m.ts"),
      );
      const pkg = path.join(r, "node_modules", "json-as");
      materializePkg(pkg);
      return { consumerFile, pkgRoot: pkg };
    },
  ],
  [
    "workspaces non-hoisted (nested node_modules)",
    () => {
      const r = root();
      const consumerFile = mkConsumer(
        path.join(r, "packages", "app", "assembly", "m.ts"),
      );
      const pkg = path.join(r, "packages", "app", "node_modules", "json-as");
      materializePkg(pkg);
      return { consumerFile, pkgRoot: pkg };
    },
  ],
  [
    "pnpm workspaces (deep consumer, symlink to .pnpm)",
    () => {
      const r = root();
      const consumerFile = mkConsumer(
        path.join(r, "apps", "web", "assembly", "deep", "m.ts"),
      );
      const real = path.join(
        r,
        "node_modules",
        ".pnpm",
        "json-as@1.3.7_x",
        "node_modules",
        "json-as",
      );
      materializePkg(real);
      const link = path.join(r, "apps", "web", "node_modules", "json-as");
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(real, link, "dir");
      return { consumerFile, pkgRoot: fs.realpathSync(link) };
    },
  ],
  [
    "npm/yarn link & file: (symlink to external checkout)",
    () => {
      const r = root();
      const consumerFile = mkConsumer(path.join(r, "proj", "assembly", "m.ts"));
      const dev = path.join(r, "dev", "json-as"); // external checkout, leaf == json-as
      materializePkg(dev);
      const link = path.join(r, "proj", "node_modules", "json-as");
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(dev, link, "dir");
      return { consumerFile, pkgRoot: fs.realpathSync(link) };
    },
  ],
  [
    "in-repo dev (no node_modules; relative)",
    () => {
      const r = root();
      const repo = path.join(r, "json-as");
      const consumerFile = mkConsumer(
        path.join(repo, "assembly", "__benches__", "m.ts"),
      );
      materializePkg(repo);
      return { consumerFile, pkgRoot: repo };
    },
  ],
];

let failed = 0;
let skipped = 0;
for (const [label, build] of builders) {
  let info;
  try {
    info = build();
  } catch (e) {
    if (e && (e.code === "EPERM" || e.code === "EACCES")) {
      console.log(`  ~ ${label} (skipped: symlinks not permitted here)`);
      skipped++;
      continue;
    }
    throw e;
  }
  const fromDir = path.dirname(info.consumerFile);
  const baseRel = computeImportBaseRel(fromDir, info.pkgRoot);
  let ok = true;
  for (const [name, seg] of Object.entries(SUBPATHS)) {
    const spec = path.posix.join(baseRel, ...seg);
    if (!resolves(fromDir, spec)) {
      console.error(`  ✗ ${label}: ${name} -> "${spec}" did NOT resolve`);
      ok = false;
      failed++;
    }
  }
  if (ok)
    console.log(
      `  ✓ ${label}  (baseRel="${baseRel}", all 5 imports incl. bs resolve)`,
    );
}

fs.rmSync(tmp, { recursive: true, force: true });

if (failed > 0) {
  console.error(`\n${failed} resolution(s) failed.`);
  process.exit(1);
}
console.log(
  `\nAll import-resolution layouts passed${skipped ? ` (${skipped} skipped)` : ""}.`,
);
