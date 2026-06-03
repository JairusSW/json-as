import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench.js";

const v1: string = "hello world";
const v2 = '"hello world"';

bench(
  "Serialize string",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-string", "serialize");

bench(
  "Deserialize string",
  () => {
    blackbox(JSON.parse(v2));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-string", "deserialize");
