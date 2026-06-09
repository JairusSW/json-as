import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  blackbox,
  bench,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";


@json
class CanadaProperties {
  name: string = "";
}


@json
class CanadaGeometry {
  type: string = "";
  coordinates: Array<Array<Array<f64>>> = [];
}


@json
class CanadaFeature {
  type: string = "";
  properties: CanadaProperties = new CanadaProperties();
  geometry: CanadaGeometry = new CanadaGeometry();
}


@json
class Canada {
  type: string = "";
  features: Array<CanadaFeature> = [];
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/canada.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/canada.min.json");

expect(JSON.stringify(JSON.parse<Canada>(prettyJson))).toBe(minJson);
expect(JSON.stringify(JSON.parse<Canada>(minJson))).toBe(minJson);

const canada = JSON.parse<Canada>(prettyJson);
const out = "";

bench(
  "Deserialize Canada (pretty)",
  () => {
    blackbox(JSON.parse<Canada>(prettyJson, canada));
  },
  500,
  utf8ByteLength(prettyJson),
);
dumpToFile("canada-pretty", "deserialize");

bench(
  "Deserialize Canada (min)",
  () => {
    blackbox(JSON.parse<Canada>(minJson, canada));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("canada-min", "deserialize");

bench(
  "Serialize Canada (min)",
  () => {
    blackbox(JSON.stringify(canada, out));
  },
  1000,
  utf8ByteLength(minJson),
);
dumpToFile("canada-min", "serialize");
