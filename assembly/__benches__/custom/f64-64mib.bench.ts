// Throughput head-to-head for `JSON.parse<f64[]>` at ~64 MiB of input.
//
// Cycles a representative mix of float widths so the parser sees small
// integer-shaped floats, fractions, negative values, and exponent forms.

import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";

function buildF64Json(targetBytes: i32): string {
  // ~64 chars per cycle of representative widths.
  let block = "";
  for (let i = 0; i < 16; i++) {
    block += "0,1.5,-2.25,3.141592653589793,1e-7,6.022e23,1000.0,-0.125,";
  }
  const blockBytes = String.UTF8.byteLength(block);
  const repeats = i32(
    Math.max(1, Math.floor(f64(targetBytes - 2 + 1) / f64(blockBytes))),
  );
  const joined = block.repeat(repeats);
  return "[" + joined.slice(0, joined.length - 1) + "]";
}

const json64mib = buildF64Json(64 * 1024 * 1024);
const bytes64mib = String.UTF8.byteLength(json64mib);

expect(JSON.parse<f64[]>(json64mib)[0]).toBe(0.0);

bench(
  "Deserialize f64[] (~64mib)",
  () => {
    blackbox(JSON.parse<f64[]>(json64mib));
  },
  10,
  bytes64mib,
);
dumpToFile("f64-64mib", "deserialize");
