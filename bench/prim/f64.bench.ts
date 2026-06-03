import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench.js";

const v1: number = 3.141592653589793;
const v2 = "3.141592653589793";

bench(
  "Serialize f64",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-f64", "serialize");

bench(
  "Deserialize f64",
  () => {
    blackbox(JSON.parse(v2));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-f64", "deserialize");
