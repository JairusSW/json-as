// Targets the unsigned struct-field path for `Array<u32>` to verify the
// parser choice in `deserializeIntegerArrayInto`. Mirrors the i32 variant
// but covers the unsigned code path (currently routed through
// `deserializeUnsignedField` -> `deserializeUnsignedField_SWAR`).

import { JSON } from "../..";
import { bench, blackbox, dumpToFile } from "../lib/bench";


@json
class UintArrayBag {
  values: Array<u32> = [];
}

// Mixed widths up to the u32 ceiling. Includes wider runs (8-10 digits) where
// parse8 would normally amortize itself; the bench will show whether parse8
// vs parse4 wins for this corpus.
const cycle: u32[] = [
  7, 42, 1234, 65535, 1234567, 4294967295, 1000000, 99999, 4321, 100, 12, 123,
  12345, 123456, 12345678, 123456789,
];
const count: i32 = 1_000_000;
const arr: u32[] = new Array<u32>(count);
for (let i = 0; i < count; i++) unchecked((arr[i] = unchecked(cycle[i & 15])));
const bag = new UintArrayBag();
bag.values = arr;
const json = JSON.stringify(bag);
const bytes = String.UTF8.byteLength(json);
const jsonStart = changetype<usize>(json);
const jsonEnd = jsonStart + (json.length << 1);
const reuse = new UintArrayBag();

bench(
  "Deserialize {values: u32[]} (~8mib)",
  () => {
    blackbox(
      JSON.__deserialize<UintArrayBag>(
        jsonStart,
        jsonEnd,
        changetype<usize>(reuse),
      ),
    );
  },
  30,
  bytes,
);
dumpToFile("u32-array-field", "deserialize");
