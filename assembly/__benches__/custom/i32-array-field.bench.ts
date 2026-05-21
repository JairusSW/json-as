// Targets the `deserializeIntegerArrayBody` path used for `Array<i32>`
// fields on `@json` structs. Element widths span 1-10 digits so the
// SWAR 4-digit fold inside `parseSignedIntegerSWAR` gets exercised.
//
// Pure-array deserialize benches go through `deserializeIntegerArray_SWAR`
// (the top-level variant); this struct-field shape is the only one that
// touches `deserializeIntegerArrayBody`.

import { JSON } from "../..";
import { bench, blackbox, dumpToFile } from "../lib/bench";


@json
class IntArrayBag {
  values: Array<i32> = [];
}

// Cycle of mixed-width signed integers up to 10 digits, where the SWAR
// 4-digit fold helps significantly on the wider lanes.
const cycle: i32[] = [
  1, 12, 123, 1234, 12345, 123456, 1234567, 12345678, 123456789, -987654321,
  -2147483648, 1000000, 99999, 4321, 100, -7,
];
const count: i32 = 1_000_000;
const arr: i32[] = new Array<i32>(count);
for (let i = 0; i < count; i++) unchecked((arr[i] = unchecked(cycle[i & 15])));
const bag = new IntArrayBag();
bag.values = arr;
const json = JSON.stringify(bag);
const bytes = String.UTF8.byteLength(json);
const jsonStart = changetype<usize>(json);
const jsonEnd = jsonStart + (json.length << 1);
// Reused destination bag — matches the obj-deserialize bench pattern, so
// inner-array growth happens once and subsequent ops hit the warm
// `ensureArrayElementSlot` fast path with capacity already reserved.
const reuse = new IntArrayBag();

bench(
  "Deserialize {values: i32[]} (~8mib)",
  () => {
    blackbox(
      JSON.__deserialize<IntArrayBag>(
        jsonStart,
        jsonEnd,
        changetype<usize>(reuse),
      ),
    );
  },
  30,
  bytes,
);
dumpToFile("i32-array-field-64mib", "deserialize");
