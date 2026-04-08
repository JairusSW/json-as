import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";
const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';
expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<string>(v2))).toBe(v2);
bench(
  "Serialize Alphabet",
  () => {
    blackbox(inline.always(JSON.stringify(v1)));
  },
  2_400_000,
  v1.length,
);
dumpToFile("abc", "serialize");
bench(
  "Deserialize Alphabet",
  () => {
    blackbox(inline.always(JSON.parse<string>(v2)));
  },
  2_400_000,
  v2.length,
);
dumpToFile("abc", "deserialize");
