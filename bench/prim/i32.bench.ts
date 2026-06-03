import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench.js";

const v1: number = -2147483648;
const v2 = "-2147483648";

bench(
  "Serialize i32",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-i32", "serialize");

bench(
  "Deserialize i32",
  () => {
    blackbox(JSON.parse(v2));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-i32", "deserialize");
