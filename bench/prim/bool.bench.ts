import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench.js";

const v1: boolean = true;
const v2 = "true";

bench(
  "Serialize bool",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-bool", "serialize");

bench(
  "Deserialize bool",
  () => {
    blackbox(JSON.parse(v2));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-bool", "deserialize");
