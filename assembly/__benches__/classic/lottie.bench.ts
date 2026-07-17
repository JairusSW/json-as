import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  blackbox,
  bench,
  ChangingPayloads,
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
@json
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


@json
class Asset {
  id: string = "";
  layers: Layer[] = [];
}


@json
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
const prettyPayloads = new ChangingPayloads(prettyJson);
const minPayloads = new ChangingPayloads(minJson);
const out = "";

bench(
  "Deserialize Lottie (pretty)",
  () => {
    blackbox(JSON.parse<Lottie>(prettyPayloads.next()));
  },
  3000,
  utf8ByteLength(prettyJson),
);
dumpToFile("lottie-pretty", "deserialize");

bench(
  "Deserialize Lottie (min)",
  () => {
    blackbox(JSON.parse<Lottie>(minPayloads.next()));
  },
  3000,
  utf8ByteLength(minJson),
);
dumpToFile("lottie-min", "deserialize");

bench(
  "Serialize Lottie (min)",
  () => {
    blackbox(JSON.stringify(lottie, out));
  },
  6000,
  utf8ByteLength(minJson),
);
dumpToFile("lottie-min", "serialize");
