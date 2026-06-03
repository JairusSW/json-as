// Throughput bench for `JSON.parse<bool[]>` at 64 MiB of input.
//
// All three modes (NAIVE / SWAR / SIMD) route through the shared
// `deserializeBooleanArray` in `naive/array/bool.ts`, which uses a u64
// magic-constant token match against `TRUE_WORD_U64` / `FALSE_WORD_U64`
// and writes directly to a pre-sized buffer via `writePtr`.

import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";

// Build a JSON-encoded `bool[]` whose serialized form is approximately
// `targetBytes` bytes. Alternates `true,false,...` so the parser sees an
// even mix of the 4- and 5-char tokens.
function buildBoolJson(targetBytes: i32): string {
  // One full alternating cycle: "true,false," = 11 chars per pair.
  let block = "";
  for (let i = 0; i < 32; i++) {
    block += i % 2 == 0 ? "true," : "false,";
  }
  const blockBytes = String.UTF8.byteLength(block);
  const repeats = i32(
    Math.max(1, Math.floor(f64(targetBytes - 2 + 1) / f64(blockBytes))),
  );
  const joined = block.repeat(repeats);
  // Strip the trailing comma from the last repeat so the array ends cleanly.
  return "[" + joined.slice(0, joined.length - 1) + "]";
}

const json64mib = buildBoolJson(64 * 1024 * 1024);
const bytes64mib = String.UTF8.byteLength(json64mib);

// Sanity: round-trip the payload before timing it.
expect(JSON.stringify(JSON.parse<bool[]>(json64mib))).toBe(json64mib);

bench(
  "Deserialize bool[] (64mib)",
  () => {
    blackbox(JSON.parse<bool[]>(json64mib));
  },
  10,
  bytes64mib,
);
dumpToFile("bool-64mib", "deserialize");
