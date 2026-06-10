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


@json({ lazy: "auto" })
class CanadaProperties {
  name: string = "";
}


@json({ lazy: "auto" })
class CanadaGeometry {
  type: string = "";
  coordinates: Array<Array<Array<f64>>> = [];
}


@json({ lazy: "auto" })
class CanadaFeature {
  type: string = "";
  properties: CanadaProperties = new CanadaProperties();
  geometry: CanadaGeometry = new CanadaGeometry();
}


@json({ lazy: "auto" })
class Canada {
  type: string = "";
  features: Array<CanadaFeature> = [];
}

function touchRoot(root: Canada): f64 {
  let s = <f64>root.type.length;
  for (let i = 0, n = root.features.length; i < n; i++) {
    const feature = unchecked(root.features[i]);
    s += <f64>feature.type.length;
    s += <f64>feature.properties.name.length;
    s += <f64>feature.geometry.type.length;
  }
  return s;
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/canada.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/canada.min.json");

expect(JSON.stringify(JSON.parse<Canada>(minJson))).toBe(minJson);

const canada = JSON.parse<Canada>(prettyJson);

bench(
  "Deserialize Canada Lazy (pretty)",
  () => {
    const root = JSON.parse<Canada>(prettyJson);
    blackbox(touchRoot(root));
  },
  500,
  utf8ByteLength(prettyJson),
);
dumpToFile("canada-lazy-pretty", "deserialize");

bench(
  "Deserialize Canada Lazy (min)",
  () => {
    const root = JSON.parse<Canada>(minJson);
    blackbox(touchRoot(root));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("canada-lazy-min", "deserialize");

bench(
  "Serialize Canada Lazy (min)",
  () => {
    blackbox(JSON.stringify(canada));
  },
  1000,
  utf8ByteLength(minJson),
);
dumpToFile("canada-lazy-min", "serialize");
