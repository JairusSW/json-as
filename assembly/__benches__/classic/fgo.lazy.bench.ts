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

// fgo (yyjson_benchmark): a 46 MB Fate/Grand Order game-data dump - one object
// of 193 "mst*"/"view*"/"npc*" tables, each a large irregular array. Modeled as
// a dynamic-key Map<string, JSON.Raw>: every table is captured as a raw slice
// (near-zero-allocation passthrough). This is both the only viable shape at this
// size and more robust than a 193-field struct. Minified-only (matches
// yyjson_benchmark).

function touchRoot(root: Map<string, JSON.Raw>): f64 {
  const vals = root.values();
  let s = 0.0;
  for (let i = 0, n = vals.length; i < n; i++)
    s += <f64>unchecked(vals[i]).data.length;
  return s;
}

const minJson = readFile("./assembly/__benches__/payloads/fgo.min.json");

expect(JSON.parse<Map<string, JSON.Raw>>(minJson).size).toBe(193);

const fgo = JSON.parse<Map<string, JSON.Raw>>(minJson);

bench(
  "Deserialize FGO Lazy (min)",
  () => {
    const root = JSON.parse<Map<string, JSON.Raw>>(minJson);
    blackbox(touchRoot(root));
  },
  40,
  utf8ByteLength(minJson),
);
dumpToFile("fgo-lazy-min", "deserialize");

bench(
  "Serialize FGO Lazy (min)",
  () => {
    blackbox(JSON.stringify(fgo));
  },
  80,
  utf8ByteLength(minJson),
);
dumpToFile("fgo-lazy-min", "serialize");
