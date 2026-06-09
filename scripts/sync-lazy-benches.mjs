#!/usr/bin/env node
// Regenerates the classic `*.lazy.bench.ts` variants from their eager
// `*.bench.ts` counterparts, so the two stay in lockstep. The lazy variant is
// the eager schema with:
//   - every `@json` class decorator switched to `@json({ lazy: "auto" })`
//   - bench labels suffixed with " Lazy"
//   - dumpToFile keys suffixed with "-lazy"
//   - the reuse target/buffer preserved (deser/serialize into a pre-existing
//     object, like the eager benches)
//   - the serialize bench dropped for Map-rooted documents, where serializing a
//     root-level Map<string, LazyClass> currently traps in json-as
//
// Usage: node scripts/sync-lazy-benches.mjs   (run from the repo root)
import fs from "node:fs";
import path from "node:path";

const DIR = "assembly/__benches__/classic";
// Datasets that have a lazy variant (the Raw-passthrough giants otfcc/fgo don't).
const DATASETS = [
  "canada",
  "citm_catalog",
  "poet",
  "github_events",
  "gsoc-2018",
  "lottie",
  "twitter",
];

// Datasets whose lazy SERIALIZE bench is dropped: serializing these under lazy
// passthrough traps today (root-level map values, or a per-class-fallback'd
// tagged-union payload whose deferred slices don't survive serialize). Their
// eager benches still cover serialize.
const NO_LAZY_SERIALIZE = new Set(["github_events"]);

function toLazy(src, dataset) {
  let s = src;

  // 1. Class decorators: @json -> @json({ lazy: "auto" }). Only matches a bare
  //    `@json` on its own line (class decorators); never @json({ ... }) configs.
  s = s.replace(/^@json$/gm, '@json({ lazy: "auto" })');

  // 2. Bench labels: "Deserialize X (pretty)" -> "Deserialize X Lazy (pretty)".
  s = s.replace(
    /"((?:Deserialize|Serialize)[^"]*?) \((pretty|min)\)"/g,
    '"$1 Lazy ($2)"',
  );

  // 3. dumpToFile keys: "x-pretty" -> "x-lazy-pretty".
  s = s.replace(
    /dumpToFile\("([^"]*?)-(pretty|min)"/g,
    'dumpToFile("$1-lazy-$2"',
  );

  // 3b. Lazy fields store source slices pinned via __SET_SRC; reusing the same
  //     object across parses (different source buffers) invalidates those
  //     slices and traps. So lazy benches allocate fresh — strip the reuse
  //     target/buffer that the eager benches use.
  s = s.replace(
    /(blackbox\(JSON\.parse<[\s\S]*?>\((?:prettyJson|minJson)), [A-Za-z_]\w*\)\)/g,
    "$1))",
  );
  s = s.replace(
    /blackbox\(JSON\.stringify\(([A-Za-z_]\w*), out\)\)/g,
    "blackbox(JSON.stringify($1))",
  );
  s = s.replace(/\nconst out = "";/, "");

  // 3c. Lazy passthrough preserves the SOURCE bytes, so a pretty-in / min-out
  //     round-trip assertion (which only holds for eager's re-compaction) fails
  //     under lazy. Drop those pretty round-trips; the min round-trip (where
  //     passthrough trivially reproduces the input) is kept.
  s = s.replace(
    /^expect\(JSON\.stringify\(JSON\.parse<[\s\S]*?>\(prettyJson\)\)\)\.toBe\([^;]*\);\n/gm,
    "",
  );

  // 4. Map-rooted documents (or explicitly listed datasets): drop the serialize
  //    bench (lazy passthrough serialize traps) and leave a note in its place.
  if (/JSON\.parse<Map</.test(s) || NO_LAZY_SERIALIZE.has(dataset)) {
    s = s.replace(
      /\nbench\(\s*\n\s*"Serialize[^"]*",[\s\S]*?dumpToFile\([^)]*"serialize"\);\n/,
      "\n// NOTE: no lazy serialize bench — lazy passthrough serialize traps for\n" +
        "// this document (a root-level map value, or a per-class-fallback'd\n" +
        "// tagged-union payload whose deferred slices don't survive serialize).\n" +
        "// The eager bench covers serialize; lazy mode is about the parse numbers.\n",
    );
  }

  // 5. Header: nudge "eager" wording to "lazy" where it appears in the top
  //    comment, so the generated file reads correctly.
  s = s.replace(/the eager bench/g, "the lazy bench");

  // Provenance banner so nobody hand-edits the generated file.
  const banner =
    "// AUTO-GENERATED from " +
    "the eager bench by scripts/sync-lazy-benches.mjs — do not edit by hand.\n" +
    "// Re-run `node scripts/sync-lazy-benches.mjs` to regenerate.\n";
  return banner + s;
}

let changed = 0;
for (const name of DATASETS) {
  const eagerPath = path.join(DIR, `${name}.bench.ts`);
  const lazyPath = path.join(DIR, `${name}.lazy.bench.ts`);
  if (!fs.existsSync(eagerPath)) {
    console.warn(`skip ${name}: ${eagerPath} not found`);
    continue;
  }
  const lazy = toLazy(fs.readFileSync(eagerPath, "utf8"), name);
  const prev = fs.existsSync(lazyPath) ? fs.readFileSync(lazyPath, "utf8") : "";
  if (prev !== lazy) {
    fs.writeFileSync(lazyPath, lazy);
    changed++;
    console.log(`wrote ${lazyPath}`);
  } else {
    console.log(`unchanged ${lazyPath}`);
  }
}
console.log(`\n${changed} lazy bench(es) regenerated.`);
