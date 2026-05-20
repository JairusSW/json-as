// Throughput bench for `JSON.parse<Float64Array | Int32Array>(...)`.
//
// Existing `simple/typedarray.ts` is a two-pass scalar implementation:
// a count-pass scans for digit-starts, then the parse pass calls
// `JSON.__deserialize` per element which scans the digits again. This
// bench targets the SWAR rewrite (one comma-count SWAR pass + an
// inline SWAR parse pass over `dataStart + index * elementSize`).

import { JSON } from "../..";
import { bench, blackbox, dumpToFile } from "../lib/bench";

// ---------------------------------------------------------------------------
// Float64Array: ~64 MiB JSON with mixed-width floats
// ---------------------------------------------------------------------------
const f64Cycle: f64[] = [
  0.0, 1.5, -2.25, 3.141592653589793, 1e-7, 6.022e23, 1000.0, -0.125,
];
const f64Count: i32 = 6_000_000;
const f64Src: f64[] = new Array<f64>(f64Count);
for (let i = 0; i < f64Count; i++)
  unchecked((f64Src[i] = unchecked(f64Cycle[i & 7])));
const f64Json = JSON.stringify(f64Src);
const f64Bytes = String.UTF8.byteLength(f64Json);

bench(
  "Deserialize Float64Array (~64mib)",
  () => {
    blackbox(JSON.parse<Float64Array>(f64Json));
  },
  10,
  f64Bytes,
);
dumpToFile("typedarray-deser-f64", "deserialize");

// ---------------------------------------------------------------------------
// Int32Array: ~64 MiB JSON with mixed-width signed integers
// ---------------------------------------------------------------------------
const i32Cycle: i32[] = [
  1, 12, 123, 1234, 12345, 123456, 1234567, 12345678, 123456789, -987654321,
  -2147483648, 1000000, 99999, 4321, 100, -7,
];
const i32Count: i32 = 8_000_000;
const i32Src: i32[] = new Array<i32>(i32Count);
for (let i = 0; i < i32Count; i++)
  unchecked((i32Src[i] = unchecked(i32Cycle[i & 15])));
const i32Json = JSON.stringify(i32Src);
const i32Bytes = String.UTF8.byteLength(i32Json);

bench(
  "Deserialize Int32Array (~64mib)",
  () => {
    blackbox(JSON.parse<Int32Array>(i32Json));
  },
  10,
  i32Bytes,
);
dumpToFile("typedarray-deser-i32", "deserialize");
