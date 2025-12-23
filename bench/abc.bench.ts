import { bench, blackbox } from "./lib/bench.js";

const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';

bench(
  "Serialize Alphabet",
  () => {
    blackbox(JSON.stringify(v1));
  },
  64_000_00,
  v1.length << 1,
);

bench(
  "Deserialize Alphabet",
  () => {
    blackbox(JSON.parse(v2));
  },
  64_000_00,
  v2.length << 1,
);