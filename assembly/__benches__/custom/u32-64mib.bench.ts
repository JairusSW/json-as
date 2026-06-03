// Throughput head-to-head for `JSON.parse<u32[]>` at 64 MiB of input.
//
// u32 values cycle through a mix of widths (1, 4, 7, and 10 digits) so the
// parser sees representative element sizes for a wide-integer payload.

import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";

function buildU32Json(targetBytes: i32): string {
  // Cycle through widths to exercise the SIMD 8-digit kernel as well as
  // the scalar tail: small (1), small (4), medium (7), max (10).
  let block = "";
  for (let i = 0; i < 16; i++) {
    block += "7,1234,9876543,4294967295,";
  }
  const blockBytes = String.UTF8.byteLength(block);
  const repeats = i32(
    Math.max(1, Math.floor(f64(targetBytes - 2 + 1) / f64(blockBytes))),
  );
  const joined = block.repeat(repeats);
  return "[" + joined.slice(0, joined.length - 1) + "]";
}

const json64mib = buildU32Json(64 * 1024 * 1024);
const bytes64mib = String.UTF8.byteLength(json64mib);

expect(JSON.stringify(JSON.parse<u32[]>(json64mib))).toBe(json64mib);

bench(
  "Deserialize u32[] (64mib)",
  () => {
    blackbox(JSON.parse<u32[]>(json64mib));
  },
  10,
  bytes64mib,
);
dumpToFile("u32-64mib", "deserialize");
