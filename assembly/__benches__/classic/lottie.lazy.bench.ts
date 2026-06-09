// AUTO-GENERATED from the eager bench by scripts/sync-lazy-benches.mjs — do not edit by hand.
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

// lottie (yyjson_benchmark): a Lottie/Bodymovin vector-animation document. The
// top-level metadata + layer/asset arrays are modeled as structs; the deeply
// nested, highly variable per-layer data (ks transform, ef effects, shapes) is
// kept as JSON.Raw passthrough so the bulk stays on the struct fast path.

// Layer fields are declared in a common supersequence of the per-layer-type key
// orders; the keys that vary by layer type are @optional so every layer stays on
// the fast path. ks/ef/shapes (transform/effects/shapes) are deeply irregular
// animation data kept as JSON.Raw passthrough.
@json({ lazy: "auto" })
class Layer {
  ddd: i64 = 0;
  ind: i64 = 0;
  ty: i64 = 0;
  nm: string = "";


  @optional refId: string = "";


  @optional parent: JSON.Box<i64> | null = null;
  ks: JSON.Raw | null = null;
  ao: i64 = 0;


  @optional ef: JSON.Raw | null = null;


  @optional w: i64 = 0;


  @optional h: i64 = 0;


  @optional shapes: JSON.Raw | null = null;


  @optional sw: i64 = 0;


  @optional sh: i64 = 0;


  @optional sc: string = "";
  ip: f64 = 0;
  op: f64 = 0;
  st: f64 = 0;
  bm: i64 = 0;
  sr: i64 = 0;
}


@json({ lazy: "auto" })
class Asset {
  id: string = "";
  layers: Layer[] = [];
}


@json({ lazy: "auto" })
class Lottie {
  v: string = "";
  fr: f64 = 0;
  ip: i64 = 0;
  op: f64 = 0;
  w: i64 = 0;
  h: i64 = 0;
  ddd: i64 = 0;
  assets: Asset[] = [];
  layers: Layer[] = [];
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/lottie.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/lottie.min.json");

expect(JSON.parse<Lottie>(minJson).layers.length).toBe(23);

const lottie = JSON.parse<Lottie>(prettyJson);

bench(
  "Deserialize Lottie Lazy (pretty)",
  () => {
    blackbox(JSON.parse<Lottie>(prettyJson));
  },
  3000,
  utf8ByteLength(prettyJson),
);
dumpToFile("lottie-lazy-pretty", "deserialize");

bench(
  "Deserialize Lottie Lazy (min)",
  () => {
    blackbox(JSON.parse<Lottie>(minJson));
  },
  3000,
  utf8ByteLength(minJson),
);
dumpToFile("lottie-lazy-min", "deserialize");

bench(
  "Serialize Lottie Lazy (min)",
  () => {
    blackbox(JSON.stringify(lottie));
  },
  6000,
  utf8ByteLength(minJson),
);
dumpToFile("lottie-lazy-min", "serialize");
