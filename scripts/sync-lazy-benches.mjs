#!/usr/bin/env node
// Regenerates the classic `*.lazy.bench.ts` variants from their eager
// `*.bench.ts` counterparts, so the two stay in lockstep. The lazy variant is
// the eager schema with:
//   - every `@json` class decorator switched to `@json({ lazy: "auto" })`
//   - bench labels suffixed with " Lazy"
//   - dumpToFile keys suffixed with "-lazy"
//   - deserialize benches changed from parse-and-stop to parse-and-touch, using
//     generated schema-aware accessors with bounded array/map traversal
//   - reuse target/buffer stripped because lazy fields pin source slices
//   - serialize benches dropped ONLY for the two datasets that genuinely trap
//     under lazy passthrough serialize (github_events, gsoc-2018 — deferred
//     nested structs); Raw-valued maps/fields (otfcc, fgo) serialize fine
//
// Usage: node scripts/sync-lazy-benches.mjs   (run from the repo root)
import fs from "node:fs";
import path from "node:path";

const DIR = "assembly/__benches__/classic";
// Datasets that get a lazy variant. Raw/map-heavy payloads still get lazy
// deserialize benches; their lazy serialize cases are suppressed below.
const LAZY_DATASETS = [
  "canada",
  "citm_catalog",
  "poet",
  "github_events",
  "gsoc-2018",
  "lottie",
  "twitter",
  "otfcc",
  "fgo",
];
// The dynamic JSON.Obj variant is schema-agnostic and covers every lazy dataset.
const OBJ_DATASETS = LAZY_DATASETS;

// Datasets whose lazy SERIALIZE bench is dropped. Previously github_events and
// gsoc-2018 trapped (an absent ref lazy field with a declared default was left
// with slot==MAX but __x_val==null, so serialize hit `null as T`); that's fixed
// in the transform (__INITIALIZE now seeds __x_val), so every dataset serializes.
const NO_LAZY_SERIALIZE = new Set([]);

const NUMERIC_TYPES = new Set([
  "i8",
  "i16",
  "i32",
  "i64",
  "isize",
  "u8",
  "u16",
  "u32",
  "u64",
  "usize",
  "f32",
  "f64",
]);

function rootType(src) {
  const rootM = src.match(/JSON\.parse<([^;]+?)>\((?:prettyJson|minJson)/);
  return rootM ? rootM[1].trim() : "";
}

function stripNullable(type) {
  return type
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p && p !== "null")
    .join(" | ");
}

function extractJsonClasses(src) {
  const classes = new Map();
  const re =
    /^@json(?:\([^)]*\))?\s*\nclass\s+([A-Za-z_]\w*)[^{]*\{([\s\S]*?)^}/gm;
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const body = m[2]
      .replace(/\/\/.*$/gm, "")
      .replace(
        /^\s*@(?:alias|omitif|omitnull|skip|serializer|deserializer)[^\n]*$/gm,
        "",
      );
    const fields = [];
    const fieldRe =
      /^\s*(?:@optional\s+)?([A-Za-z_]\w*)\s*:\s*([^=;]+?)(?:\s*=\s*[^;]*)?;/gm;
    for (const f of body.matchAll(fieldRe)) {
      fields.push({ name: f[1], type: f[2].trim() });
    }
    classes.set(name, fields);
  }
  return classes;
}

function touchExpr(type, expr, classes) {
  type = type.trim();
  const boxM = type.match(/^JSON\.Box<(.+)>$/);
  if (boxM) return `<f64>${expr}.value`;
  if (type === "string") return `<f64>${expr}.length`;
  if (type === "bool" || type === "boolean") return `${expr} ? 1.0 : 0.0`;
  if (NUMERIC_TYPES.has(type)) return `<f64>${expr}`;
  if (type === "JSON.Raw") return `<f64>${expr}.data.length`;
  if (classes.has(type)) return `touch${type}(${expr})`;
  return "0.0";
}

function touchStmt(type, expr, classes, tmp, indent = "  ") {
  type = type.trim();
  if (type.includes("| null")) {
    const inner = stripNullable(type);
    return (
      `${indent}const ${tmp} = ${expr};\n` +
      `${indent}if (${tmp} !== null) {\n` +
      touchStmt(inner, tmp, classes, `${tmp}v`, `${indent}  `) +
      `\n${indent}}`
    );
  }
  if (type.endsWith("[]")) {
    const inner = type.slice(0, -2).trim();
    return (
      `${indent}const ${tmp}N = ${expr}.length < TOUCH_LIMIT ? ${expr}.length : TOUCH_LIMIT;\n` +
      `${indent}for (let i = 0, n = ${tmp}N; i < n; i++) {\n` +
      touchStmt(
        inner,
        `unchecked(${expr}[i])`,
        classes,
        `${tmp}v`,
        `${indent}  `,
      ) +
      `\n${indent}}`
    );
  }
  const mapM = type.match(/^Map<string,\s*(.+)>$/);
  if (mapM) {
    const inner = mapM[1].trim();
    return (
      `${indent}const ${tmp}Vals = ${expr}.values();\n` +
      `${indent}const ${tmp}N = ${tmp}Vals.length < TOUCH_LIMIT ? ${tmp}Vals.length : TOUCH_LIMIT;\n` +
      `${indent}for (let i = 0, n = ${tmp}N; i < n; i++) {\n` +
      touchStmt(
        inner,
        `unchecked(${tmp}Vals[i])`,
        classes,
        `${tmp}v`,
        `${indent}  `,
      ) +
      `\n${indent}}`
    );
  }
  return `${indent}s += ${touchExpr(type, expr, classes)};`;
}

function customLazyTouch(root) {
  switch (root) {
    case "Canada":
      return `function touchRoot(root: Canada): f64 {
  let s = <f64>root.type.length;
  for (let i = 0, n = root.features.length; i < n; i++) {
    const feature = unchecked(root.features[i]);
    s += <f64>feature.type.length;
    s += <f64>feature.properties.name.length;
    s += <f64>feature.geometry.type.length;
  }
  return s;
}`;
    case "Citm":
      return `function touchRoot(root: Citm): f64 {
  let s = 0.0;
  for (let i = 0, n = root.performances.length; i < n; i++) {
    const perf = unchecked(root.performances[i]);
    s += <f64>perf.eventId + <f64>perf.id + <f64>perf.start;
    const name = perf.name;
    if (name !== null) s += <f64>name.length;
    s += <f64>perf.venueCode.length;
  }
  const events = root.events.values();
  const limit = events.length < 8 ? events.length : 8;
  for (let i = 0, n = limit; i < n; i++) {
    const event = unchecked(events[i]);
    s += <f64>event.id + <f64>event.name.length;
    const subject = event.subjectCode;
    if (subject !== null) s += <f64>subject.length;
  }
  return s;
}`;
    case "Poem[]":
      return `function touchRoot(root: Poem[]): f64 {
  let s = 0.0;
  for (let i = 0, n = root.length; i < n; i++) {
    const poem = unchecked(root[i]);
    s += <f64>poem.desc.length;
    s += <f64>poem.name.length;
    s += <f64>poem.id.length;
  }
  return s;
}`;
    case "GhEvent[]":
      return `function touchRoot(root: GhEvent[]): f64 {
  let s = 0.0;
  for (let i = 0, n = root.length; i < n; i++) {
    const event = unchecked(root[i]);
    s += <f64>event.type.length;
    s += <f64>event.created_at.length;
    s += <f64>event.actor.login.length + <f64>event.actor.id;
    s += <f64>event.repo.name.length + <f64>event.repo.id;
    s += event.isPublic ? 1.0 : 0.0;
  }
  return s;
}`;
    case "Map<string, Org>":
      return `function touchRoot(root: Map<string, Org>): f64 {
  const keys = root.keys();
  let s = <f64>root.size;
  for (let i = 0, n = keys.length; i < n; i++) s += <f64>unchecked(keys[i]).length;
  return s;
}`;
    case "Lottie":
      return `function touchRoot(root: Lottie): f64 {
  let s = <f64>root.v.length + root.fr + <f64>root.w + <f64>root.h + root.op;
  for (let i = 0, n = root.layers.length; i < n; i++) {
    const layer = unchecked(root.layers[i]);
    s += <f64>layer.nm.length + <f64>layer.ty + layer.ip + layer.op;
    const ks = layer.ks;
    if (ks !== null) s += <f64>ks.data.length;
    const shapes = layer.shapes;
    if (shapes !== null) s += <f64>shapes.data.length;
  }
  for (let i = 0, n = root.assets.length; i < n; i++) {
    const asset = unchecked(root.assets[i]);
    s += <f64>asset.id.length;
    for (let j = 0, m = asset.layers.length; j < m; j++) {
      const layer = unchecked(asset.layers[j]);
      s += <f64>layer.nm.length + <f64>layer.ty;
    }
  }
  return s;
}`;
    case "Otfcc":
      return `function touchRoot(root: Otfcc): f64 {
  let s = 0.0;
  const head = root.head; if (head !== null) s += <f64>head.data.length;
  const hhea = root.hhea; if (hhea !== null) s += <f64>hhea.data.length;
  const maxp = root.maxp; if (maxp !== null) s += <f64>maxp.data.length;
  const vhea = root.vhea; if (vhea !== null) s += <f64>vhea.data.length;
  const post = root.post; if (post !== null) s += <f64>post.data.length;
  const os2 = root.OS_2; if (os2 !== null) s += <f64>os2.data.length;
  const name = root.name; if (name !== null) s += <f64>name.data.length;
  const cmap = root.cmap; if (cmap !== null) s += <f64>cmap.data.length;
  const cmapUvs = root.cmap_uvs; if (cmapUvs !== null) s += <f64>cmapUvs.data.length;
  const cff = root.CFF_; if (cff !== null) s += <f64>cff.data.length;
  const glyf = root.glyf; if (glyf !== null) s += <f64>glyf.data.length;
  const glyphOrder = root.glyph_order; if (glyphOrder !== null) s += <f64>glyphOrder.data.length;
  const gsub = root.GSUB; if (gsub !== null) s += <f64>gsub.data.length;
  const gpos = root.GPOS; if (gpos !== null) s += <f64>gpos.data.length;
  const base = root.BASE; if (base !== null) s += <f64>base.data.length;
  return s;
}`;
    case "Map<string, JSON.Raw>":
      return `function touchRoot(root: Map<string, JSON.Raw>): f64 {
  const vals = root.values();
  let s = 0.0;
  for (let i = 0, n = vals.length; i < n; i++) s += <f64>unchecked(vals[i]).data.length;
  return s;
}`;
    default:
      return null;
  }
}

function lazyTouchHelpers(src) {
  const root = rootType(src);
  const custom = customLazyTouch(root);
  if (custom !== null) return custom;
  if (root === "Twitter") {
    return `function touchRoot(root: Twitter): f64 {
  let s = 0.0;
  for (let i = 0, n = root.statuses.length; i < n; i++) {
    const status = unchecked(root.statuses[i]);
    s += <f64>status.created_at.length;
    s += <f64>status.id;
    s += <f64>status.text.length;
    const inReply = status.in_reply_to_status_id;
    if (inReply !== null) s += <f64>inReply.value;
    s += <f64>status.user.id;
    s += <f64>status.user.screen_name.length;
    s += <f64>status.retweet_count;
    s += <f64>status.favorite_count;
  }
  return s;
}

function touchFindTweet(root: Twitter): f64 {
  for (let i = 0, n = root.statuses.length; i < n; i++) {
    const status = unchecked(root.statuses[i]);
    if (status.id == 505874901689851904) return <f64>status.text.length;
  }
  return 0.0;
}

function touchTopTweet(root: Twitter): f64 {
  let best = -1;
  let bestIndex = -1;
  for (let i = 0, n = root.statuses.length; i < n; i++) {
    const count = unchecked(root.statuses[i]).retweet_count;
    if (count <= 60 && count >= best) {
      best = count;
      bestIndex = i;
    }
  }
  if (bestIndex < 0) return 0.0;
  const status = unchecked(root.statuses[bestIndex]);
  return <f64>best + <f64>status.text.length + <f64>status.user.screen_name.length;
}

function touchDistinctUserId(root: Twitter): f64 {
  let s = 0.0;
  for (let i = 0, n = root.statuses.length; i < n; i++) {
    const status = unchecked(root.statuses[i]);
    s += <f64>status.user.id;
    const retweeted = status.retweeted_status;
    if (retweeted !== null) s += <f64>retweeted.user.id;
  }
  return s;
}`;
  }
  const classes = extractJsonClasses(src);
  const helpers = ["const TOUCH_LIMIT: i32 = 8;"];
  for (const [name, fields] of classes) {
    const lines = [
      `function touch${name}(root: ${name}): f64 {`,
      "  let s = 0.0;",
    ];
    for (const [i, field] of fields.entries()) {
      lines.push(touchStmt(field.type, `root.${field.name}`, classes, `v${i}`));
    }
    lines.push("  return s;", "}");
    helpers.push(lines.join("\n"));
  }

  if (classes.has(root)) {
    helpers.push(
      `function touchRoot(root: ${root}): f64 {\n  return touch${root}(root);\n}`,
    );
  } else if (/^Map<string,\s*JSON\.Raw>$/.test(root)) {
    helpers.push(
      `function touchRoot(root: ${root}): f64 {\n` +
        "  const vals = root.values();\n" +
        "  let s = 0.0;\n" +
        "  const limit = vals.length < TOUCH_LIMIT ? vals.length : TOUCH_LIMIT;\n" +
        "  for (let i = 0, n = limit; i < n; i++) s += <f64>unchecked(vals[i]).data.length;\n" +
        "  return s;\n" +
        "}",
    );
  } else {
    helpers.push(`function touchRoot(root: ${root}): f64 {\n  return 0.0;\n}`);
  }
  return helpers.join("\n\n");
}

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
  //     slices and traps. So lazy benches allocate fresh - strip the reuse
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

  // 3d. Match simdjson's benchmark shape more closely: parse, then read enough
  //     of the result to force lazy fields to materialize. The generated
  //     touchRoot is schema-aware for @json classes and raw/map roots.
  s = s.replace(
    /blackbox\(JSON\.parse<([\s\S]*?)>\((prettyJson|minJson)\)\);/g,
    "const root = JSON.parse<$1>($2);\n    blackbox(touchRoot(root));",
  );

  if (dataset === "twitter") {
    s = s.replace(
      /dumpToFile\("twitter-lazy-min", "deserialize"\);\n/,
      `dumpToFile("twitter-lazy-min", "deserialize");

bench(
  "Find Tweet Twitter Lazy (min)",
  () => {
    const root = JSON.parse<Twitter>(minJson);
    blackbox(touchFindTweet(root));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-find_tweet-lazy-min", "deserialize");

bench(
  "Top Tweet Twitter Lazy (min)",
  () => {
    const root = JSON.parse<Twitter>(minJson);
    blackbox(touchTopTweet(root));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-top_tweet-lazy-min", "deserialize");

bench(
  "Distinct User ID Twitter Lazy (min)",
  () => {
    const root = JSON.parse<Twitter>(minJson);
    blackbox(touchDistinctUserId(root));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-distinct_user_id-lazy-min", "deserialize");
`,
    );
  }

  // 4. Drop the serialize bench only for datasets that genuinely trap under lazy
  //    passthrough serialize (verified empirically): documents with deferred
  //    nested *structs* whose slices don't survive serialize — github_events'
  //    per-class-fallback tagged-union `payload`, and gsoc-2018's
  //    `Map<string, Org>`. Raw-valued maps/fields (fgo, otfcc) serialize fine.
  if (NO_LAZY_SERIALIZE.has(dataset)) {
    s = s.replace(
      /\nbench\(\s*\n\s*"Serialize[^"]*",[\s\S]*?dumpToFile\([^)]*"serialize"\);\n/,
      "\n// NOTE: no lazy serialize bench - lazy passthrough serialize traps for\n" +
        "// this document (a deferred nested struct - tagged-union payload or a\n" +
        "// Map<string, struct> - whose slices don't survive serialize). The eager\n" +
        "// bench covers serialize; lazy mode is about the parse numbers.\n",
    );
  }

  // 5. Header: nudge "eager" wording to "lazy" where it appears in the top
  //    comment, so the generated file reads correctly.
  s = s.replace(/the eager bench/g, "the lazy bench");

  // Provenance banner so nobody hand-edits the generated file.
  const banner =
    "// AUTO-GENERATED from " +
    "the eager bench by scripts/sync-lazy-benches.mjs - do not edit by hand.\n" +
    "// Re-run `node scripts/sync-lazy-benches.mjs` to regenerate.\n";
  const helpers = lazyTouchHelpers(src);
  const withHelpers = s.replace(
    /\nconst (prettyJson|minJson) = readFile/,
    `\n${helpers}\n\nconst $1 = readFile`,
  );
  return banner + (withHelpers === s ? s + "\n" + helpers + "\n" : withHelpers);
}

function objProjection(dataset) {
  const common = `function sumNumberField(root: JSON.Obj, key: string): f64 {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null ? 0.0 : value.get<f64>();
}

function sumStringField(root: JSON.Obj, key: string): f64 {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null ? 0.0 : <f64>value.get<string>().length;
}

function sumBoolField(root: JSON.Obj, key: string): f64 {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null ? 0.0 : value.get<bool>() ? 1.0 : 0.0;
}

function objField(root: JSON.Obj, key: string): JSON.Obj | null {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null ? null : value.get<JSON.Obj>();
}

function arrField(root: JSON.Obj, key: string): JSON.Arr | null {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null ? null : value.get<JSON.Arr>();
}

function sumValueKind(value: JSON.Value | null): f64 {
  return value === null || value.type == JSON.Types.Null ? 0.0 : <f64>value.type;
}

`;

  switch (dataset) {
    case "canada":
      return {
        fn: "sumCanadaProjection",
        desc: "Canada feature metadata projection",
        code:
          common +
          `function sumCanadaProjection(root: JSON.Obj): f64 {
  let s = sumStringField(root, "type");
  const features = arrField(root, "features");
  if (features === null) return s;
  for (let i = 0, n = features.length; i < n; i++) {
    const feature = features.at(i).get<JSON.Obj>();
    s += sumStringField(feature, "type");
    const props = objField(feature, "properties");
    if (props !== null) s += sumStringField(props, "name");
    const geom = objField(feature, "geometry");
    if (geom !== null) s += sumStringField(geom, "type");
  }
  return s;
}`,
      };
    case "citm_catalog":
      return {
        fn: "sumCitmProjection",
        desc: "CITM performance and event metadata projection",
        code:
          common +
          `function sumCitmProjection(root: JSON.Obj): f64 {
  let s = 0.0;
  const performances = arrField(root, "performances");
  if (performances !== null) {
    for (let i = 0, n = performances.length; i < n; i++) {
      const perf = performances.at(i).get<JSON.Obj>();
      s += sumNumberField(perf, "eventId") + sumNumberField(perf, "id") + sumNumberField(perf, "start");
      s += sumStringField(perf, "name") + sumStringField(perf, "venueCode");
    }
  }
  const events = objField(root, "events");
  if (events !== null) {
    const vals = events.values();
    const limit = vals.length < 8 ? vals.length : 8;
    for (let i = 0, n = limit; i < n; i++) {
      const event = unchecked(vals[i]).get<JSON.Obj>();
      s += sumNumberField(event, "id") + sumStringField(event, "name") + sumStringField(event, "subjectCode");
    }
  }
  return s;
}`,
      };
    case "poet":
      return {
        fn: "sumPoetProjection",
        desc: "Poet record string-field projection",
        code:
          common +
          `function sumPoetProjection(root: JSON.Arr): f64 {
  let s = 0.0;
  for (let i = 0, n = root.length; i < n; i++) {
    const poem = root.at(i).get<JSON.Obj>();
    s += sumStringField(poem, "desc") + sumStringField(poem, "name") + sumStringField(poem, "id");
  }
  return s;
}`,
      };
    case "github_events":
      return {
        fn: "sumGithubProjection",
        desc: "GitHub event metadata projection",
        code:
          common +
          `function sumGithubProjection(root: JSON.Arr): f64 {
  let s = 0.0;
  for (let i = 0, n = root.length; i < n; i++) {
    const event = root.at(i).get<JSON.Obj>();
    s += sumStringField(event, "type") + sumStringField(event, "created_at") + sumStringField(event, "id");
    const actor = objField(event, "actor");
    if (actor !== null) s += sumStringField(actor, "login") + sumNumberField(actor, "id");
    const repo = objField(event, "repo");
    if (repo !== null) s += sumStringField(repo, "name") + sumNumberField(repo, "id");
    s += sumBoolField(event, "public");
    const payload = objField(event, "payload");
    if (payload !== null) {
      s += sumStringField(payload, "action") + sumStringField(payload, "ref");
      s += sumNumberField(payload, "size") + sumNumberField(payload, "distinct_size");
      const issue = objField(payload, "issue");
      if (issue !== null) s += sumStringField(issue, "title") + sumNumberField(issue, "id");
      const comment = objField(payload, "comment");
      if (comment !== null) s += sumStringField(comment, "body") + sumNumberField(comment, "id");
    }
  }
  return s;
}`,
      };
    case "gsoc-2018":
      return {
        fn: "sumGsocProjection",
        desc: "GSOC organization metadata projection",
        code:
          common +
          `function sumGsocProjection(root: JSON.Obj): f64 {
  const vals = root.values();
  let s = 0.0;
  for (let i = 0, n = vals.length; i < n; i++) {
    const org = unchecked(vals[i]).get<JSON.Obj>();
    s += sumStringField(org, "name") + sumStringField(org, "@type");
    const sponsor = objField(org, "sponsor");
    if (sponsor !== null) s += sumStringField(sponsor, "name");
    const author = objField(org, "author");
    if (author !== null) s += sumStringField(author, "name");
  }
  return s;
}`,
      };
    case "lottie":
      return {
        fn: "sumLottieProjection",
        desc: "Lottie metadata and layer projection",
        code:
          common +
          `function sumLayerProjection(layer: JSON.Obj): f64 {
  let s = sumStringField(layer, "nm") + sumNumberField(layer, "ty") + sumNumberField(layer, "ip") + sumNumberField(layer, "op");
  s += sumValueKind(layer.get("ks")) + sumValueKind(layer.get("shapes"));
  return s;
}

function sumLottieProjection(root: JSON.Obj): f64 {
  let s = sumStringField(root, "v") + sumNumberField(root, "fr") + sumNumberField(root, "w") + sumNumberField(root, "h") + sumNumberField(root, "op");
  const layers = arrField(root, "layers");
  if (layers !== null) {
    for (let i = 0, n = layers.length; i < n; i++) s += sumLayerProjection(layers.at(i).get<JSON.Obj>());
  }
  const assets = arrField(root, "assets");
  if (assets !== null) {
    for (let i = 0, n = assets.length; i < n; i++) {
      const asset = assets.at(i).get<JSON.Obj>();
      s += sumStringField(asset, "id");
      const assetLayers = arrField(asset, "layers");
      if (assetLayers !== null) {
        for (let j = 0, m = assetLayers.length; j < m; j++) s += sumLayerProjection(assetLayers.at(j).get<JSON.Obj>());
      }
    }
  }
  return s;
}`,
      };
    case "otfcc":
      return {
        fn: "sumOtfccProjection",
        desc: "OTFCC top-level table projection",
        code:
          common +
          `function sumOtfccProjection(root: JSON.Obj): f64 {
  const vals = root.values();
  let s = 0.0;
  for (let i = 0, n = vals.length; i < n; i++) s += sumValueKind(unchecked(vals[i]));
  return s;
}`,
      };
    case "fgo":
      return {
        fn: "sumFgoProjection",
        desc: "FGO top-level table projection",
        code:
          common +
          `function sumFgoProjection(root: JSON.Obj): f64 {
  const vals = root.values();
  let s = 0.0;
  for (let i = 0, n = vals.length; i < n; i++) s += sumValueKind(unchecked(vals[i]));
  return s;
}`,
      };
    default:
      return { fn: null, desc: "bounded subset of values", code: "" };
  }
}

// Build a self-contained dynamic `*.obj.bench.ts` from the eager bench: it drops
// the struct schema entirely and (de)serializes the payload as a `JSON.Obj` (or
// `JSON.Arr` for array-rooted documents) - the on-demand dynamic path. Used for
// the "JSON.Obj (SIMD)" series on the classic charts. Deserialize measures parse
// plus bounded value access; serialize measures the untouched-passthrough re-emit.
function toObj(src, dataset) {
  const paths = [
    ...src.matchAll(/readFile\(\s*"([^"]+\.(?:pretty|min)\.json)"\s*,?\s*\)/g),
  ].map((m) => m[1]);
  const prettyPath = paths.find((p) => p.includes(".pretty.")) || paths[0];
  const minPath = paths.find((p) => p.includes(".min.")) || paths[1];
  // Root type -> dynamic container. Array-rooted (`X[]`) docs use JSON.Arr; maps
  // and plain objects use JSON.Obj.
  const rootM = src.match(/JSON\.parse<([^;]+?)>\((?:prettyJson|minJson)/);
  const root = rootM ? rootM[1].trim() : "";
  const dyn = /\[\]$/.test(root) ? "JSON.Arr" : "JSON.Obj";
  // Reuse the eager bench's min-deserialize iteration count (dataset-tuned).
  const itM = src.match(/(\d+),\s*utf8ByteLength\(minJson\)/);
  const iters = itM ? itM[1] : "1000";
  const label = dataset;
  const banner =
    "// AUTO-GENERATED from the eager bench by scripts/sync-lazy-benches.mjs - do not edit by hand.\n" +
    "// Re-run `node scripts/sync-lazy-benches.mjs` to regenerate.\n";
  const projection = objProjection(dataset);
  const customObjTouch =
    dataset === "twitter"
      ? `function sumNumberField(root: JSON.Obj, key: string): f64 {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null ? 0.0 : value.get<f64>();
}

function sumStringField(root: JSON.Obj, key: string): f64 {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null ? 0.0 : <f64>value.get<string>().length;
}

function sumPartialTweet(status: JSON.Obj): f64 {
  let s = 0.0;
  s += sumStringField(status, "created_at");
  s += sumNumberField(status, "id");
  s += sumStringField(status, "text");
  s += sumNumberField(status, "in_reply_to_status_id");
  const userValue = status.get("user");
  if (userValue !== null && userValue.type != JSON.Types.Null) {
    const user = userValue.get<JSON.Obj>();
    s += sumNumberField(user, "id");
    s += sumStringField(user, "screen_name");
  }
  s += sumNumberField(status, "retweet_count");
  s += sumNumberField(status, "favorite_count");
  return s;
}

function sumTwitterPartial(root: JSON.Obj): f64 {
  const statusesValue = root.get("statuses");
  if (statusesValue === null || statusesValue.type == JSON.Types.Null) return 0.0;
  const statuses = statusesValue.get<JSON.Arr>();
  let s = 0.0;
  for (let i = 0, n = statuses.length; i < n; i++) {
    s += sumPartialTweet(statuses.at(i).get<JSON.Obj>());
  }
  return s;
}

function sumFindTweet(root: JSON.Obj): f64 {
  const statusesValue = root.get("statuses");
  if (statusesValue === null || statusesValue.type == JSON.Types.Null) return 0.0;
  const statuses = statusesValue.get<JSON.Arr>();
  for (let i = 0, n = statuses.length; i < n; i++) {
    const status = statuses.at(i).get<JSON.Obj>();
    if (sumNumberField(status, "id") == 505874901689851904.0) {
      return sumStringField(status, "text");
    }
  }
  return 0.0;
}

function sumTopTweet(root: JSON.Obj): f64 {
  const statusesValue = root.get("statuses");
  if (statusesValue === null || statusesValue.type == JSON.Types.Null) return 0.0;
  const statuses = statusesValue.get<JSON.Arr>();
  let best = -1.0;
  let bestIndex = -1;
  for (let i = 0, n = statuses.length; i < n; i++) {
    const status = statuses.at(i).get<JSON.Obj>();
    const count = sumNumberField(status, "retweet_count");
    if (count <= 60.0 && count >= best) {
      best = count;
      bestIndex = i;
    }
  }
  if (bestIndex < 0) return 0.0;
  const status = statuses.at(bestIndex).get<JSON.Obj>();
  const userValue = status.get("user");
  if (userValue === null || userValue.type == JSON.Types.Null) return best + sumStringField(status, "text");
  return best + sumStringField(status, "text") + sumStringField(userValue.get<JSON.Obj>(), "screen_name");
}

function sumDistinctUserId(root: JSON.Obj): f64 {
  const statusesValue = root.get("statuses");
  if (statusesValue === null || statusesValue.type == JSON.Types.Null) return 0.0;
  const statuses = statusesValue.get<JSON.Arr>();
  let s = 0.0;
  for (let i = 0, n = statuses.length; i < n; i++) {
    const status = statuses.at(i).get<JSON.Obj>();
    const userValue = status.get("user");
    if (userValue !== null && userValue.type != JSON.Types.Null) {
      s += sumNumberField(userValue.get<JSON.Obj>(), "id");
    }
    const retweetedValue = status.get("retweeted_status");
    if (retweetedValue !== null && retweetedValue.type != JSON.Types.Null) {
      const retweeted = retweetedValue.get<JSON.Obj>();
      const retweetedUser = retweeted.get("user");
      if (retweetedUser !== null && retweetedUser.type != JSON.Types.Null) {
        s += sumNumberField(retweetedUser.get<JSON.Obj>(), "id");
      }
    }
  }
  return s;
}`
      : projection.code;
  const rootSum = dyn === "JSON.Arr" ? "sumArr" : "sumObj";
  const parseSum =
    dataset === "twitter" ? "sumTwitterPartial" : projection.fn || rootSum;
  const touchDescription =
    dataset === "twitter"
      ? "simdjson partial_tweets-style subset of values"
      : projection.desc;
  return (
    banner +
    `import { JSON } from "../..";
import {
  bench,
  blackbox,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// Dynamic ${dyn} (de)serialize of the ${dataset} payload - schema-agnostic, for
// the JSON.Obj series on the classic charts. Deserialize parses and touches a
// ${touchDescription} so the benchmark does not measure a touch-nothing parse.
const prettyJson = readFile("${prettyPath}");
const minJson = readFile("${minPath}");
// Parsed once (untouched) for the passthrough serialize bench.
const doc = JSON.parse<${dyn}>(minJson);
const TOUCH_LIMIT: i32 = 8;

function sumValue(value: JSON.Value): f64 {
  switch (value.type) {
    case JSON.Types.Null:
      return 0.0;
    case JSON.Types.Bool:
      return value.get<bool>() ? 1.0 : 0.0;
    case JSON.Types.String:
      return <f64>value.get<string>().length;
    case JSON.Types.Object:
      return sumObj(value.get<JSON.Obj>());
    case JSON.Types.Array:
      return sumArr(value.get<JSON.Arr>());
    case JSON.Types.Raw:
      return <f64>value.get<JSON.Raw>().data.length;
    default:
      return value.toString().length;
  }
}

function sumObj(root: JSON.Obj): f64 {
  const vals = root.values();
  let s = 0.0;
  const limit = vals.length < TOUCH_LIMIT ? vals.length : TOUCH_LIMIT;
  for (let i = 0, n = limit; i < n; i++) s += sumValue(unchecked(vals[i]));
  return s;
}

function sumArr(root: JSON.Arr): f64 {
  let s = 0.0;
  const limit = root.length < TOUCH_LIMIT ? root.length : TOUCH_LIMIT;
  for (let i = 0, n = limit; i < n; i++) s += sumValue(root.at(i));
  return s;
}

${customObjTouch}

bench(
  "Deserialize ${label} (JSON.Obj, pretty)",
  () => {
    blackbox(${parseSum}(JSON.parse<${dyn}>(prettyJson)));
  },
  ${iters},
  utf8ByteLength(prettyJson),
);
dumpToFile("${dataset}-obj-pretty", "deserialize");

bench(
  "Deserialize ${label} (JSON.Obj, min)",
  () => {
    blackbox(${parseSum}(JSON.parse<${dyn}>(minJson)));
  },
  ${iters},
  utf8ByteLength(minJson),
);
dumpToFile("${dataset}-obj-min", "deserialize");

${
  dataset === "twitter"
    ? `bench(
  "Find Tweet twitter (JSON.Obj, min)",
  () => {
    blackbox(sumFindTweet(JSON.parse<JSON.Obj>(minJson)));
  },
  ${iters},
  utf8ByteLength(minJson),
);
dumpToFile("twitter-find_tweet-obj-min", "deserialize");

bench(
  "Top Tweet twitter (JSON.Obj, min)",
  () => {
    blackbox(sumTopTweet(JSON.parse<JSON.Obj>(minJson)));
  },
  ${iters},
  utf8ByteLength(minJson),
);
dumpToFile("twitter-top_tweet-obj-min", "deserialize");

bench(
  "Distinct User ID twitter (JSON.Obj, min)",
  () => {
    blackbox(sumDistinctUserId(JSON.parse<JSON.Obj>(minJson)));
  },
  ${iters},
  utf8ByteLength(minJson),
);
dumpToFile("twitter-distinct_user_id-obj-min", "deserialize");
`
    : ""
}

bench(
  "Serialize ${label} (JSON.Obj, min)",
  () => {
    blackbox(JSON.stringify(doc));
  },
  ${iters},
  utf8ByteLength(minJson),
);
dumpToFile("${dataset}-obj-min", "serialize");
`
  );
}

// (dataset, variant-suffix, generator) jobs: lazy for the 7, obj for all 9.
const JOBS = [
  ...LAZY_DATASETS.map((name) => [name, "lazy", toLazy]),
  ...OBJ_DATASETS.map((name) => [name, "obj", toObj]),
];

let changed = 0;
for (const [name, suffix, gen] of JOBS) {
  const eagerPath = path.join(DIR, `${name}.bench.ts`);
  if (!fs.existsSync(eagerPath)) {
    console.warn(`skip ${name}.${suffix}: ${eagerPath} not found`);
    continue;
  }
  const outPath = path.join(DIR, `${name}.${suffix}.bench.ts`);
  const next = gen(fs.readFileSync(eagerPath, "utf8"), name);
  const prev = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : "";
  if (prev !== next) {
    fs.writeFileSync(outPath, next);
    changed++;
    console.log(`wrote ${outPath}`);
  } else {
    console.log(`unchanged ${outPath}`);
  }
}
console.log(`\n${changed} bench variant(s) regenerated.`);
