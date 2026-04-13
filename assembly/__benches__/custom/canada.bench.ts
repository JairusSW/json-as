import { JSON } from "../../index.ts";
import { expect } from "../../__tests__/lib/index.ts";
import { blackbox, bench, dumpToFile } from "../lib/bench.ts";
import { canadaJson, canadaJsonChars } from "./canada.data.ts";

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
const canadaJsonStart = changetype<usize>(canadaJson);
const canadaJsonEnd = canadaJsonStart + (canadaJson.length << 1);
const typed = JSON.parse<Canada>(canadaJson);
const typedSerialized = JSON.stringify(typed);
bench(
  "Deserialize Canada",
  () => {
    blackbox(JSON.__deserialize<Canada>(canadaJsonStart, canadaJsonEnd, changetype<usize>(typed)));
  },
  40,
  canadaJsonChars,
);
dumpToFile("canada", "deserialize");
bench(
  "Serialize Canada",
  () => {
    blackbox(JSON.stringify(typed));
  },
  40,
  canadaJsonChars,
);
dumpToFile("canada", "serialize");
