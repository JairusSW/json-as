import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "./lib/bench";
const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';
expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<string>(v2))).toBe(v2);
bench(
  "Serialize Alphabet",
  () => {
    blackbox(JSON.stringify(v1));
  },
  2_400_000,
  utf8ByteLength(v2),
);
dumpToFile("abc", "serialize");
bench(
  "Deserialize Alphabet",
  () => {
    blackbox(JSON.parse<string>(v2));
  },
  2_400_000,
  utf8ByteLength(v2),
);
dumpToFile("abc", "deserialize");
