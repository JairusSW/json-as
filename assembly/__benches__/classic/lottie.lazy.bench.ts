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

@json({ lazy: "auto" })
class Layer {
  ddd: i64 = 0;
  ind: i64 = 0;
  ty: i64 = 0;
  nm: string = "";
  refId: string = "";
  ks: JSON.Raw | null = null;
  ao: i64 = 0;
  ef: JSON.Raw | null = null;
  w: i64 = 0;
  h: i64 = 0;
  ip: f64 = 0;
  op: f64 = 0;
  st: f64 = 0;
  bm: i64 = 0;
  sr: i64 = 0;
  shapes: JSON.Raw | null = null;
  parent: JSON.Box<i64> | null = null;
  sw: i64 = 0;
  sh: i64 = 0;
  sc: string = "";
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
