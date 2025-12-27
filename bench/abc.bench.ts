import { dumpToFile } from "./lib/bench.js";
import { bench, blackbox } from "./lib/bench.js";

const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';

bench(
  "Serialize Alphabet",
  () => {
    blackbox(JSON.stringify(v1));
  },
  24_000_00,
  v1.length << 1,
);
dumpToFile("abc", "serialize")

bench(
  "Deserialize Alphabet",
  () => {
    blackbox(JSON.parse(v2));
  },
  24_000_00,
  v2.length << 1,
);
dumpToFile("abc", "deserialize")