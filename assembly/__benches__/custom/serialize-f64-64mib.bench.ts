// Throughput head-to-head for `JSON.stringify<f64[]>` at ~64 MiB of output.
//
// Cycles a representative mix of float widths so the Żmij writer sees small
// integer-shaped floats, fractions, negative values, and exponent forms —
// mirroring the `f64-64mib` deserialize bench.

import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";

// Average width per element in the cycle is ~10 ASCII chars (+ 1 comma).
// 64 MiB / 11 ~= 6.1M elements; round to a multiple of the 8-element cycle.
const cycle: f64[] = [
  0.0, 1.5, -2.25, 3.141592653589793, 1e-7, 6.022e23, 1000.0, -0.125,
];
const count: i32 = 6_000_000;
const f64In: f64[] = new Array<f64>(count);
for (let i = 0; i < count; i++) unchecked((f64In[i] = unchecked(cycle[i & 7])));
const bytes = String.UTF8.byteLength(JSON.stringify(f64In));
expect(JSON.parse<f64[]>(JSON.stringify(f64In))[0]).toBe(0.0);

bench(
  "Serialize f64[] (~64mib)",
  () => {
    blackbox(JSON.stringify(f64In));
  },
  10,
  bytes,
);
dumpToFile("serialize-f64-64mib", "serialize");
