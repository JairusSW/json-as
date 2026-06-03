import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench";

const v1: f64 = 3.141592653589793;
const v2 = "3.141592653589793";

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<f64>(v2))).toBe(v2);

bench(
  "Serialize f64",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-f64", "serialize");

bench(
  "Deserialize f64",
  () => {
    blackbox(JSON.parse<f64>(v2));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-f64", "deserialize");
