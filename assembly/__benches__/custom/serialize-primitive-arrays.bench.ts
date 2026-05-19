// Throughput baseline for `JSON.stringify` of primitive arrays.
//
// Three input shapes:
//   1. `u8[]` with ~15M elements (mixed 1-3 digit widths)
//   2. `bool[]` with ~12M elements (alternating true/false)
//   3. `i32[]` with ~6M elements (mixed widths)
//
// Each input is sized so the JSON output is roughly 64 MiB, matching the
// deserialize benches.

import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";

// ---------------------------------------------------------------------------
// u8[]: cycle 0..255 -> ~15M elements -> ~64 MiB serialized
// ---------------------------------------------------------------------------
const u8Count = 15_000_000;
const u8In: u8[] = new Array<u8>(u8Count);
for (let i = 0; i < u8Count; i++) unchecked((u8In[i] = u8(i & 0xff)));
const u8Bytes = String.UTF8.byteLength(JSON.stringify(u8In));
expect(JSON.parse<u8[]>(JSON.stringify(u8In))[0]).toBe(u8In[0]);

bench(
  "Serialize u8[] (~64mib)",
  () => {
    blackbox(JSON.stringify(u8In));
  },
  10,
  u8Bytes,
);
dumpToFile("serialize-u8-64mib", "serialize");

// ---------------------------------------------------------------------------
// bool[]: alternating true/false
// ---------------------------------------------------------------------------
const boolCount = 12_000_000;
const boolIn: bool[] = new Array<bool>(boolCount);
for (let i = 0; i < boolCount; i++) unchecked((boolIn[i] = (i & 1) == 0));
const boolBytes = String.UTF8.byteLength(JSON.stringify(boolIn));
expect(JSON.parse<bool[]>(JSON.stringify(boolIn))[0]).toBe(boolIn[0]);

bench(
  "Serialize bool[] (~64mib)",
  () => {
    blackbox(JSON.stringify(boolIn));
  },
  10,
  boolBytes,
);
dumpToFile("serialize-bool-64mib", "serialize");

// ---------------------------------------------------------------------------
// i32[]: cycle 1, 1234, 9876543, -2147483648
// ---------------------------------------------------------------------------
const i32Count = 6_000_000;
const i32In: i32[] = new Array<i32>(i32Count);
const i32Cycle: i32[] = [1, 1234, 9876543, -2147483648];
for (let i = 0; i < i32Count; i++)
  unchecked((i32In[i] = unchecked(i32Cycle[i & 3])));
const i32Bytes = String.UTF8.byteLength(JSON.stringify(i32In));
expect(JSON.parse<i32[]>(JSON.stringify(i32In))[0]).toBe(i32In[0]);

bench(
  "Serialize i32[] (~64mib)",
  () => {
    blackbox(JSON.stringify(i32In));
  },
  10,
  i32Bytes,
);
dumpToFile("serialize-i32-64mib", "serialize");
