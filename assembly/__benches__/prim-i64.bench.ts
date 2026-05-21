import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";

const v1: i64 = -9223372036854775808;
const v2 = "-9223372036854775808";

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<i64>(v2))).toBe(v2);

bench(
  "Serialize i64",
  () => {
    blackbox(inline.always(JSON.stringify(v1)));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-i64", "serialize");

bench(
  "Deserialize i64",
  () => {
    blackbox(inline.always(JSON.parse<i64>(v2)));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-i64", "deserialize");
