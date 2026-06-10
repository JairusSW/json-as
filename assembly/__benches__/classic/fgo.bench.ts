import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  blackbox,
  bench,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// fgo (yyjson_benchmark): a 46 MB Fate/Grand Order game-data dump - one object
// of 193 "mst*"/"view*"/"npc*" tables, each a large irregular array. Modeled as
// a dynamic-key Map<string, JSON.Raw>: every table is captured as a raw slice
// (near-zero-allocation passthrough). This is both the only viable shape at this
// size and more robust than a 193-field struct. Minified-only (matches
// yyjson_benchmark).

const minJson = readFile("./assembly/__benches__/payloads/fgo.min.json");

expect(JSON.parse<Map<string, JSON.Raw>>(minJson).size).toBe(193);

const fgo = JSON.parse<Map<string, JSON.Raw>>(minJson);
const out = "";

bench(
  "Deserialize FGO (min)",
  () => {
    blackbox(JSON.parse<Map<string, JSON.Raw>>(minJson, fgo));
  },
  40,
  utf8ByteLength(minJson),
);
dumpToFile("fgo-min", "deserialize");

bench(
  "Serialize FGO (min)",
  () => {
    blackbox(JSON.stringify(fgo, out));
  },
  80,
  utf8ByteLength(minJson),
);
dumpToFile("fgo-min", "serialize");
