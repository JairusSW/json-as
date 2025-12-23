import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox } from "./lib/bench";

const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';

expect(JSON.stringify(v1)).toBe(v2);

bench(
  "Serialize Alphabet",
  () => {
    blackbox(inline.always(JSON.stringify(v1)));
  },
  24_000_00,
  v1.length << 1,
);

bench(
  "Deserialize Alphabet",
  () => {
    blackbox(inline.always(JSON.parse<string>(v2)));
  },
  24_000_00,
  v2.length << 1,
);
