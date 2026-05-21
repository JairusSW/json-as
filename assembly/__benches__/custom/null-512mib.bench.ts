// Throughput bench for `JSON.parse<(string | null)[]>` at ~512 MiB.
//
// Pure top-level path — the dispatcher routes string-array parses through
// `swar/array/string.ts:deserializeStringArray_SWAR` in SWAR/SIMD modes.
// Per-element work: one `load<u64>` of the `null` token + compare to
// `NULL_WORD_U64`, then `store<usize>(slot, 0)` (AS's null reference is
// the zero pointer) + 8-byte advance. No String allocation, no Box object,
// no per-element capacity check after the array warms.
//
// 512 MiB UTF-8 ASCII = 512 Mi chars = 1 GiB UTF-16, the largest single
// managed string AS's GC allows (BLOCK_MAXSIZE = (1 << 30) - 16 bytes).

import { JSON } from "../..";
import { bench, blackbox, dumpToFile } from "../lib/bench";

// Build the JSON directly via __new + memory.copy. Avoids the intermediate
// string-concat/slice peaks that would push past wasm's 4 GiB cap during
// construction at this size.
function buildNullsJson(targetChars: i32): string {
  // `null,` is 5 chars per element; the final comma gets overwritten by
  // the closing `]` after the loop.
  const pattern: string = "null,";
  const patternChars: i32 = pattern.length;

  const innerCharsTarget: i32 = targetChars - 2; // brackets
  const repeats: i32 = innerCharsTarget / patternChars;
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
  // Final char is currently `,`; overwrite with `]`.
  store<u16>(ptr + totalBytes - 2, 93); // ']'

  return changetype<string>(ptr);
}

// One KiB under 512 MiB chars keeps the final UTF-16 byte size safely
// below BLOCK_MAXSIZE = (1 << 30) - 16. The `null,` stride is 5 chars
// wide so rounding can drift by a few bytes; slack is noise at this scale.
const TARGET_CHARS: i32 = 512 * 1024 * 1024 - 1024;
const json: string = buildNullsJson(TARGET_CHARS);
const jsonBytes: u64 = u64(json.length);

bench(
  "Deserialize (string | null)[] (~512MiB nulls)",
  () => {
    blackbox(JSON.parse<(string | null)[]>(json));
  },
  10,
  jsonBytes,
);
dumpToFile("null-512mib", "deserialize");
