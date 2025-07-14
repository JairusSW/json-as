import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench } from "./lib/bench";

const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';

const blackBoxArea = memory.data(64);
expect(JSON.stringify(v1)).toBe(v2);

bench(
  "Serialize Alphabet",
  () => {
    blackbox(inline.always(JSON.stringify(blackbox(v1))));
  },
  24_000_00,
  v1.length << 1,
);

bench(
  "Deserialize Alphabet",
  () => {
    blackbox(inline.always(JSON.parse<string>(blackbox(v2))));
  },
  24_000_00,
  v2.length << 1,
);

function blackbox<T>(value: T): T {
  store<T>(blackBoxArea, value);
  return load<T>(blackBoxArea);
}
