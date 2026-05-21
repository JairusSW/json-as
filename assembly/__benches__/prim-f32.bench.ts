import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";

const v1: f32 = 3.1415927;
const v2 = "3.1415927";

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<f32>(v2))).toBe(v2);

bench(
  "Serialize f32",
  () => {
    blackbox(inline.always(JSON.stringify(v1)));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-f32", "serialize");

bench(
  "Deserialize f32",
  () => {
    blackbox(inline.always(JSON.parse<f32>(v2)));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-f32", "deserialize");
