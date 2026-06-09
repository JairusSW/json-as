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
// (parse records slice offsets; serialize copies them back) — the only viable
// shape for a file this size. Minified-only (the pretty form is ~195 MB);
// yyjson_benchmark likewise ships otfcc minified.

@json
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

const minJson = readFile("./assembly/__benches__/payloads/otfcc.min.json");

expect(JSON.parse<Otfcc>(minJson).glyf != null).toBe(true);

const otfcc = JSON.parse<Otfcc>(minJson);
const out = "";

bench(
  "Deserialize OTFCC (min)",
  () => {
    blackbox(JSON.parse<Otfcc>(minJson, otfcc));
  },
  40,
  utf8ByteLength(minJson),
);
dumpToFile("otfcc-min", "deserialize");

bench(
  "Serialize OTFCC (min)",
  () => {
    blackbox(JSON.stringify(otfcc, out));
  },
  80,
  utf8ByteLength(minJson),
);
dumpToFile("otfcc-min", "serialize");
