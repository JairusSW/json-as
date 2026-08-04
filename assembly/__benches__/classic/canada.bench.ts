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


@json
class CanadaProperties {
  name!: string;
}


@json
class CanadaGeometry {
  type!: string;
  coordinates!: Array<Array<Array<f64>>>;
}


@json
class CanadaFeature {
  type!: string;
  properties!: CanadaProperties;
  geometry!: CanadaGeometry;
}


@json
class Canada {
  type!: string;
  features!: Array<CanadaFeature>;
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/canada.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/canada.min.json");
const freshPayloads = new ChangingPayloads(minJson);
const reusePayloads = new ChangingPayloads(minJson);
const reuseTarget = JSON.parse<Canada>(minJson);

expect(JSON.stringify(JSON.parse<Canada>(prettyJson))).toBe(minJson);
expect(JSON.stringify(JSON.parse<Canada>(minJson))).toBe(minJson);

const canada = JSON.parse<Canada>(prettyJson);
const out = "";

bench(
  "Deserialize Canada (pretty)",
  () => {
    blackbox(JSON.parse<Canada>(prettyJson));
  },
  500,
  utf8ByteLength(prettyJson),
);
dumpToFile("canada-pretty", "deserialize");

bench(
  "Deserialize Canada (min)",
  () => {
    blackbox(JSON.parse<Canada>(freshPayloads.next()));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("canada-min", "deserialize");
bench(
  "Deserialize Canada (min, reuse)",
  () => {
    blackbox(JSON.parse<Canada>(reusePayloads.next(), reuseTarget));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("canada-min-reuse", "deserialize");

bench(
  "Serialize Canada (min)",
  () => {
    blackbox(JSON.stringify(canada, out));
  },
  1000,
  utf8ByteLength(minJson),
);
dumpToFile("canada-min", "serialize");
