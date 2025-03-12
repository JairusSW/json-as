import { bench } from "./lib/bench";

const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';

bench(
  "Serialize Alphabet",
  () => {
    JSON.stringify(v1);
  },
  64_000_00,
);

bench(
  "Deserialize Alphabet",
  () => {
    JSON.parse(v2);
  },
  64_000_00,
);
