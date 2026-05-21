import { bench, blackbox, dumpToFile } from "./lib/bench.js";

const v1: string = "hello world";
const v2 = '"hello world"';

bench(
  "Serialize string",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-string", "serialize");

bench(
  "Deserialize string",
  () => {
    blackbox(JSON.parse(v2));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-string", "deserialize");
