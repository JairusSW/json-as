import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench } from "./lib/bench";

const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';

expect(JSON.stringify(v1)).toBe(v2);

bench(
  "Serialize Alphabet",
  () => {
    inline.always(JSON.stringify(v1));
  },
  24_000_00,
);

bench(
  "Deserialize Alphabet",
  () => {
    inline.always(JSON.parse<string>(v2));
  },
  24_000_00,
);
