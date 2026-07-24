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
@json
class Layer {
  ddd!: i64;
  ind!: i64;
  ty!: i64;
  nm!: string;


  @optional refId!: string;


  @optional parent!: JSON.Box<i64> | null;
  ks!: JSON.Raw | null;
  ao!: i64;


  @optional ef!: JSON.Raw | null;


  @optional w!: i64;


  @optional h!: i64;


  @optional shapes!: JSON.Raw | null;


  @optional sw!: i64;


  @optional sh!: i64;


  @optional sc!: string;
  ip!: f64;
  op!: f64;
  st!: f64;
  bm!: i64;
  sr!: i64;
}


@json
class Asset {
  id!: string;
  layers!: Layer[];
}


@json
class Lottie {
  v!: string;
  fr!: f64;
  ip!: i64;
  op!: f64;
  w!: i64;
  h!: i64;
  ddd!: i64;
  assets!: Asset[];
  layers!: Layer[];
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/lottie.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/lottie.min.json");

expect(JSON.parse<Lottie>(minJson).layers.length).toBe(23);

const lottie = JSON.parse<Lottie>(prettyJson);
const out = "";

bench(
  "Deserialize Lottie (pretty)",
  () => {
    blackbox(JSON.parse<Lottie>(prettyJson));
  },
  3000,
  utf8ByteLength(prettyJson),
);
dumpToFile("lottie-pretty", "deserialize");

bench(
  "Deserialize Lottie (min)",
  () => {
    blackbox(JSON.parse<Lottie>(minJson));
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
