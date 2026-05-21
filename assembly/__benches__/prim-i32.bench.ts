import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";

const v1: i32 = -2147483648;
const v2 = "-2147483648";

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<i32>(v2))).toBe(v2);

bench(
  "Serialize i32",
  () => {
    blackbox(inline.always(JSON.stringify(v1)));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-i32", "serialize");

bench(
  "Deserialize i32",
  () => {
    blackbox(inline.always(JSON.parse<i32>(v2)));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-i32", "deserialize");
