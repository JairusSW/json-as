import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench.js";

// JS has no native i64; use a BigInt for the value but serialize via string
// to match the JSON-AS i64 path. We benchmark the closest equivalent: parsing
// and stringifying a 20-character integer literal that fits in i64 range.
const v1: number = Number.MIN_SAFE_INTEGER;
const v2 = "-9223372036854775808";

bench(
  "Serialize i64",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-i64", "serialize");

bench(
  "Deserialize i64",
  () => {
    blackbox(JSON.parse(v2));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-i64", "deserialize");
