import { JSON } from "..";
import { bench } from "../custom/bench";

const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';

bench(
  "Serialize Alphabet",
  () => {
    JSON.stringify(v1);
  },
  6_000_00,
);

bench(
  "Deserialize Alphabet",
  () => {
    JSON.parse<string>(v2);
  },
  6_000_00,
);
