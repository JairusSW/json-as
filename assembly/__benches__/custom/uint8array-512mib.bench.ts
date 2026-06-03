// Round-trip throughput at ~512 MiB of JSON (UTF-8 byte size).
//
// AS's incremental GC caps single allocations at BLOCK_MAXSIZE = (1 << 30)
// - 16 bytes. JSON is stored internally as UTF-16, so a 512 MiB UTF-8
// ASCII payload occupies ~1 GiB in memory — right against that ceiling.
// Going larger than this isn't reachable with a single managed string.
//
// Wasm32 caps total addressable memory at 4 GiB. With the source JSON
// (~1 GiB UTF-16), the parsed Uint8Array (~134 MiB) and a per-op
// re-serialized output (another ~1 GiB) potentially live at the same
// moment, so the bench is structured to keep peak working set comfortably
// below the ceiling:
//
//   1. The JSON string is built via a single `__new` + `memory.copy` loop
//      — no string-concat / slice intermediates that would peak at 3-6× the
//      final size during construction.
//   2. The deserialize bench runs first, then the JSON reference is dropped
//      and a GC pass reclaims the 1 GiB. The serialize bench then has room
//      for its per-op output allocation.

import { JSON } from "../..";
import { bench, blackbox, dumpToFile } from "../lib/bench";

// Build a JSON string of `targetChars` UTF-16 code units in one allocation.
// AS strings carry an i32 rtSize, so the maximum addressable string is
// just under 2 GiB of bytes — but BLOCK_MAXSIZE (~1 GiB) is the tighter
// limit in practice.
function buildBigU8Json(targetChars: i32): string {
  // 4 mid-range u8 values per pattern, 4 chars per element on average.
  const pattern: string = "100,200,150,255,";
  const patternChars: i32 = pattern.length;

  // Total layout: "[" + (pattern × N - last comma) + "]"
  const innerChars: i32 = targetChars - 2;
  const repeats: i32 = innerChars / patternChars;
  const finalInnerChars: i32 = repeats * patternChars - 1;
  const totalChars: i32 = finalInnerChars + 2;

  const totalBytes: usize = (<usize>totalChars) << 1;
  const ptr = __new(totalBytes, idof<string>());
  store<u16>(ptr, 91); // '['
  let dst: usize = ptr + 2;
  const patPtr: usize = changetype<usize>(pattern);
  const patBytes: usize = (<usize>patternChars) << 1;
  for (let i: i32 = 0; i < repeats; i++) {
    memory.copy(dst, patPtr, patBytes);
    dst += patBytes;
  }
  // Final char position. Replace the trailing comma with ']'.
  store<u16>(ptr + totalBytes - 2, 93); // ']'

  return changetype<string>(ptr);
}

// 512 MiB UTF-8 ASCII = 512 Mi chars = 1 GiB UTF-16. Single string fits
// comfortably under BLOCK_MAXSIZE (~1 GiB - 16 bytes).
const TARGET_CHARS: i32 = 512 * 1024 * 1024;
let bigJson: string = buildBigU8Json(TARGET_CHARS);
const jsonBytes: u64 = String.UTF8.byteLength(bigJson);

bench(
  "Deserialize Uint8Array (~512MiB)",
  () => {
    blackbox(JSON.parse<Uint8Array>(bigJson));
  },
  10,
  jsonBytes,
);
dumpToFile("uint8array-512mib", "deserialize");

// Drop the source string so the serialize bench has room to allocate
// its ~1 GiB output per op without crossing the 4 GiB wasm cap.
bigJson = "";
__collect();

// Source Uint8Array sized to produce roughly the same byte count when
// re-serialized: 4 elements per 16-char pattern, so element count =
// repeats × 4 where repeats matches the construction above.
const patternElements: i32 = 4;
const patternCharsConst: i32 = 16;
const srcCount: i32 =
  ((TARGET_CHARS - 2) / patternCharsConst) * patternElements;
const srcArr: Uint8Array = new Uint8Array(srcCount);
const cycle: u8[] = [100, 200, 150, 255];
for (let i: i32 = 0; i < srcCount; i++) {
  unchecked((srcArr[i] = unchecked(cycle[i & 3])));
}

bench(
  "Serialize Uint8Array (~512MiB)",
  () => {
    blackbox(JSON.stringify(srcArr));
  },
  10,
  jsonBytes,
);
dumpToFile("uint8array-512mib", "serialize");
