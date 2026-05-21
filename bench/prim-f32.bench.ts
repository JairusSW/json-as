import { bench, blackbox, dumpToFile } from "./lib/bench.js";

// JS numbers are f64; we still emit the same 7-digit value for shape parity
// with the AS f32 bench.
const v1: number = 3.1415927;
const v2 = "3.1415927";

bench(
  "Serialize f32",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-f32", "serialize");

bench(
  "Deserialize f32",
  () => {
    blackbox(JSON.parse(v2));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-f32", "deserialize");
