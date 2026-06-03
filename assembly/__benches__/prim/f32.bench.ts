import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench";

const v1: f32 = 3.1415927;
const v2 = "3.1415927";

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<f32>(v2))).toBe(v2);

bench(
  "Serialize f32",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-f32", "serialize");

bench(
  "Deserialize f32",
  () => {
    blackbox(JSON.parse<f32>(v2));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-f32", "deserialize");
