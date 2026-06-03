import { dumpToFile } from "./lib/bench.js";
import { bench, blackbox, utf8ByteLength } from "./lib/bench.js";

const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';

bench(
  "Serialize Alphabet",
  () => {
    blackbox(JSON.stringify(v1));
  },
  24_000_00,
  utf8ByteLength(v1),
);
dumpToFile("abc", "serialize");

bench(
  "Deserialize Alphabet",
  () => {
    blackbox(JSON.parse(v2));
  },
  24_000_00,
  utf8ByteLength(v2),
);
dumpToFile("abc", "deserialize");
