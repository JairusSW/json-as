import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";

const v1: f64 = 3.141592653589793;
const v2 = "3.141592653589793";

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<f64>(v2))).toBe(v2);

bench(
  "Serialize f64",
  () => {
    blackbox(inline.always(JSON.stringify(v1)));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-f64", "serialize");

bench(
  "Deserialize f64",
  () => {
    blackbox(inline.always(JSON.parse<f64>(v2)));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-f64", "deserialize");
