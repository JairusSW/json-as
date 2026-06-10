// AUTO-GENERATED from the eager bench by scripts/sync-lazy-benches.mjs - do not edit by hand.
// Re-run `node scripts/sync-lazy-benches.mjs` to regenerate.
import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  blackbox,
  bench,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// otfcc (yyjson_benchmark): a 63 MB OpenType font dump (otfcc's JSON form). The
// document is one object of 15 font tables; `glyf`/`CFF_`/`GSUB`/`GPOS` are
// deeply irregular and enormous, so every table is modeled as a JSON.Raw
// passthrough. This keeps it on the struct fast path with near-zero allocation
// (parse records slice offsets; serialize copies them back) - the only viable
// shape for a file this size. Minified-only (the pretty form is ~195 MB);
// yyjson_benchmark likewise ships otfcc minified.

@json({ lazy: "auto" })
class Otfcc {
  head: JSON.Raw | null = null;
  hhea: JSON.Raw | null = null;
  maxp: JSON.Raw | null = null;
  vhea: JSON.Raw | null = null;
  post: JSON.Raw | null = null;
  OS_2: JSON.Raw | null = null;
  name: JSON.Raw | null = null;
  cmap: JSON.Raw | null = null;
  cmap_uvs: JSON.Raw | null = null;
  CFF_: JSON.Raw | null = null;
  glyf: JSON.Raw | null = null;
  glyph_order: JSON.Raw | null = null;
  GSUB: JSON.Raw | null = null;
  GPOS: JSON.Raw | null = null;
  BASE: JSON.Raw | null = null;
}

function touchRoot(root: Otfcc): f64 {
  let s = 0.0;
  const head = root.head;
  if (head !== null) s += <f64>head.data.length;
  const hhea = root.hhea;
  if (hhea !== null) s += <f64>hhea.data.length;
  const maxp = root.maxp;
  if (maxp !== null) s += <f64>maxp.data.length;
  const vhea = root.vhea;
  if (vhea !== null) s += <f64>vhea.data.length;
  const post = root.post;
  if (post !== null) s += <f64>post.data.length;
  const os2 = root.OS_2;
  if (os2 !== null) s += <f64>os2.data.length;
  const name = root.name;
  if (name !== null) s += <f64>name.data.length;
  const cmap = root.cmap;
  if (cmap !== null) s += <f64>cmap.data.length;
  const cmapUvs = root.cmap_uvs;
  if (cmapUvs !== null) s += <f64>cmapUvs.data.length;
  const cff = root.CFF_;
  if (cff !== null) s += <f64>cff.data.length;
  const glyf = root.glyf;
  if (glyf !== null) s += <f64>glyf.data.length;
  const glyphOrder = root.glyph_order;
  if (glyphOrder !== null) s += <f64>glyphOrder.data.length;
  const gsub = root.GSUB;
  if (gsub !== null) s += <f64>gsub.data.length;
  const gpos = root.GPOS;
  if (gpos !== null) s += <f64>gpos.data.length;
  const base = root.BASE;
  if (base !== null) s += <f64>base.data.length;
  return s;
}

const minJson = readFile("./assembly/__benches__/payloads/otfcc.min.json");

expect(JSON.parse<Otfcc>(minJson).glyf != null).toBe(true);

const otfcc = JSON.parse<Otfcc>(minJson);

bench(
  "Deserialize OTFCC Lazy (min)",
  () => {
    const root = JSON.parse<Otfcc>(minJson);
    blackbox(touchRoot(root));
  },
  40,
  utf8ByteLength(minJson),
);
dumpToFile("otfcc-lazy-min", "deserialize");

bench(
  "Serialize OTFCC Lazy (min)",
  () => {
    blackbox(JSON.stringify(otfcc));
  },
  80,
  utf8ByteLength(minJson),
);
dumpToFile("otfcc-lazy-min", "serialize");
