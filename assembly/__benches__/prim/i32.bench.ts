import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench";

const v1: i32 = -2147483648;
const v2 = "-2147483648";

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<i32>(v2))).toBe(v2);

bench(
  "Serialize i32",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-i32", "serialize");

bench(
  "Deserialize i32",
  () => {
    blackbox(JSON.parse<i32>(v2));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-i32", "deserialize");
