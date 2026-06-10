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

function touchRoot(root: Lottie): f64 {
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
    const root = JSON.parse<Lottie>(prettyJson);
    blackbox(touchRoot(root));
  },
  3000,
  utf8ByteLength(prettyJson),
);
dumpToFile("lottie-lazy-pretty", "deserialize");

bench(
  "Deserialize Lottie Lazy (min)",
  () => {
    const root = JSON.parse<Lottie>(minJson);
    blackbox(touchRoot(root));
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
