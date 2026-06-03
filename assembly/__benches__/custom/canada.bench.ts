import { JSON } from "../../index.ts";
import { expect } from "../../__tests__/lib/index.ts";
import {
  blackbox,
  bench,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench.ts";


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

// Module-level hot state for the closure-free bench routines (AS has no
// closures, so the routines passed to `bench` read these globals instead of
// capturing locals).
let curStart: usize = 0;
let curEnd: usize = 0;
let curTyped: Canada = new Canada();

function deserRoutine(): void {
  blackbox(
    JSON.__deserialize<Canada>(curStart, curEnd, changetype<usize>(curTyped)),
  );
}
function serRoutine(): void {
  blackbox(JSON.stringify(curTyped));
}

// Runs deserialize + serialize against one payload variant. `variant` becomes
// the dump suffix ("canada-pretty" / "canada-min"). Throughput is normalized by
// that variant's char count, so the two deserialize numbers are directly
// comparable (parsing whitespace-padded vs minified input). Serialize produces
// the same minified output for both (it works off the parsed object).
function benchCanada(variant: string, json: string): void {
  curStart = changetype<usize>(json);
  curEnd = curStart + (json.length << 1);
  curTyped = JSON.parse<Canada>(json);

  bench(
    "Deserialize Canada (" + variant + ")",
    deserRoutine,
    40,
    utf8ByteLength(json),
  );
  dumpToFile("canada-" + variant, "deserialize");

  bench(
    "Serialize Canada (" + variant + ")",
    serRoutine,
    40,
    utf8ByteLength(json),
  );
  dumpToFile("canada-" + variant, "serialize");
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/canada.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/canada.min.json");

// Both variants must represent identical data (the .min is a whitespace-only
// strip of the .pretty fixture).
expect(JSON.stringify(JSON.parse<Canada>(prettyJson))).toBe(
  JSON.stringify(JSON.parse<Canada>(minJson)),
);

benchCanada("pretty", prettyJson);
benchCanada("min", minJson);
