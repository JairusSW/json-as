import { bench, blackbox, dumpToFile } from "./lib/bench.js";

const v1: number = -2147483648;
const v2 = "-2147483648";

bench(
  "Serialize i32",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-i32", "serialize");

bench(
  "Deserialize i32",
  () => {
    blackbox(JSON.parse(v2));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-i32", "deserialize");
