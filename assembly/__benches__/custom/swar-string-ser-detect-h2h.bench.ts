import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";

// Head-to-head: SWAR escape-detection function variants. Strips away the
// surrounding serialize logic so we measure pure detect-throughput per u64.
//
// Variants:
//   SAFE       : current production "safe" detect (branchy on hi==0)
//   SAFE_BL    : same, branchless (always computes hi_mask)
//   UNSAFE     : production "unsafe" detect (returns ascii_mask | raw_hi)
//   LOW_ONLY   : ascii_mask only; caller validates hi externally
//   COMBINED   : ascii_mask | hi folded into single value, no branch

// @ts-expect-error: @inline
@inline function detect_SAFE(block: u64): u64 {
  const hi = block & 0xff00_ff00_ff00_ff00;
  const lo = block & 0x00ff_00ff_00ff_00ff;
  const loSafe = lo | 0x0100_0100_0100_0100;
  const ascii_mask =
    ((loSafe - 0x0020_0020_0020_0020) |
      ((loSafe ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
      ((loSafe ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
    (0x0080_0080_0080_0080 & ~lo);
  if (hi == 0) return ascii_mask;
  const hi_mask =
    ((block - 0x0100_0100_0100_0100) & ~block & 0x8000_8000_8000_8000) ^
    0x8000_8000_8000_8000;
  return (ascii_mask & (~hi_mask >> 8)) | hi_mask;
}

// @ts-expect-error: @inline
@inline function detect_SAFE_BL(block: u64): u64 {
  const lo = block & 0x00ff_00ff_00ff_00ff;
  const loSafe = lo | 0x0100_0100_0100_0100;
  const ascii_mask =
    ((loSafe - 0x0020_0020_0020_0020) |
      ((loSafe ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
      ((loSafe ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
    (0x0080_0080_0080_0080 & ~lo);
  const hi_mask =
    ((block - 0x0100_0100_0100_0100) & ~block & 0x8000_8000_8000_8000) ^
    0x8000_8000_8000_8000;
  return (ascii_mask & (~hi_mask >> 8)) | hi_mask;
}

// @ts-expect-error: @inline
@inline function detect_UNSAFE(block: u64): u64 {
  const lo = block & 0x00ff_00ff_00ff_00ff;
  const loSafe = lo | 0x0100_0100_0100_0100;
  const ascii_mask =
    ((loSafe - 0x0020_0020_0020_0020) |
      ((loSafe ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
      ((loSafe ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
    (0x0080_0080_0080_0080 & ~lo);
  const hi = block & 0xff00_ff00_ff00_ff00;
  return ascii_mask | hi;
}

// @ts-expect-error: @inline
@inline function detect_LOW_ONLY(block: u64): u64 {
  const lo = block & 0x00ff_00ff_00ff_00ff;
  const loSafe = lo | 0x0100_0100_0100_0100;
  return (
    ((loSafe - 0x0020_0020_0020_0020) |
      ((loSafe ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
      ((loSafe ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
    (0x0080_0080_0080_0080 & ~lo)
  );
}

// COMBINED: precomputes loSafe and inlines the hi-byte test, returning a
// single u64 where any non-zero indicates "block has at least one byte
// that needs escape or is non-ASCII". Mask layout is not used by callers
// that only need a boolean.
// @ts-expect-error: @inline
@inline function detect_COMBINED(block: u64): u64 {
  const lo = block & 0x00ff_00ff_00ff_00ff;
  const loSafe = lo | 0x0100_0100_0100_0100;
  const ascii_or_hi =
    (((loSafe - 0x0020_0020_0020_0020) |
      ((loSafe ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
      ((loSafe ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
      (0x0080_0080_0080_0080 & ~lo)) |
    (block & 0xff00_ff00_ff00_ff00);
  return ascii_or_hi;
}

// --- Block corpus ---
// 4 representative blocks: pure ASCII, one ASCII escape, one non-ASCII (BMP),
// surrogate pair. Layout: 4 u16 code units packed into a u64 (little-endian).

// @ts-expect-error: @inline
@inline function packU16x4(a: u32, b: u32, c: u32, d: u32): u64 {
  return (<u64>a) | ((<u64>b) << 16) | ((<u64>c) << 32) | ((<u64>d) << 48);
}

const BLOCK_ASCII: u64 = packU16x4(0x0068, 0x0065, 0x006c, 0x006c); // "hell"
const BLOCK_ESCAPE: u64 = packU16x4(0x0068, 0x0022, 0x006c, 0x006c); // h"ll
const BLOCK_NONASCII: u64 = packU16x4(0x0068, 0x00e9, 0x006c, 0x006c); // héll
const BLOCK_SURROGATE: u64 = packU16x4(0xd83d, 0xde80, 0x0068, 0x0069); // rocket emoji + "hi"

// Build longer arrays representing real-world distributions:
//   plain  : all ASCII (~99% of typical English JSON)
//   sparse : 1 escape per 100 blocks
//   dense  : 1 escape per 8 blocks
//   nonasc : 1 non-ASCII per 20 blocks
const N_BLOCKS: i32 = 4096;

function buildCorpus(escapeStride: i32, useNonAscii: bool): StaticArray<u64> {
  const arr = new StaticArray<u64>(N_BLOCKS);
  for (let i = 0; i < N_BLOCKS; i++) {
    if (escapeStride > 0 && i % escapeStride == 0) {
      unchecked((arr[i] = useNonAscii ? BLOCK_NONASCII : BLOCK_ESCAPE));
    } else {
      unchecked((arr[i] = BLOCK_ASCII));
    }
  }
  return arr;
}

const corpusPlain = buildCorpus(0, false);
const corpusSparse = buildCorpus(100, false);
const corpusDense = buildCorpus(8, false);
const corpusNonAsc = buildCorpus(20, true);

// Verify all four detect variants agree on which blocks have any hit.
for (let i = 0; i < N_BLOCKS; i++) {
  const b = unchecked(corpusDense[i]);
  const eS = detect_SAFE(b) != 0;
  const eB = detect_SAFE_BL(b) != 0;
  const eU = detect_UNSAFE(b) != 0;
  const eL = detect_LOW_ONLY(b) | ((b & 0xff00_ff00_ff00_ff00) != 0 ? 1 : 0);
  const eC = detect_COMBINED(b) != 0;
  expect(eS).toBe(eB);
  expect(eS).toBe(eU);
  expect(eS).toBe(eL != 0);
  expect(eS).toBe(eC);
}

let CUR: usize = 0;
let CUR_LEN: i32 = 0;

function bench_SAFE(): void {
  let acc: u64 = 0;
  for (let i = 0; i < CUR_LEN; i++) {
    acc ^= detect_SAFE(load<u64>(CUR + (i << 3)));
  }
  blackbox(acc);
}
function bench_SAFE_BL(): void {
  let acc: u64 = 0;
  for (let i = 0; i < CUR_LEN; i++) {
    acc ^= detect_SAFE_BL(load<u64>(CUR + (i << 3)));
  }
  blackbox(acc);
}
function bench_UNSAFE(): void {
  let acc: u64 = 0;
  for (let i = 0; i < CUR_LEN; i++) {
    acc ^= detect_UNSAFE(load<u64>(CUR + (i << 3)));
  }
  blackbox(acc);
}
function bench_LOW_ONLY(): void {
  let acc: u64 = 0;
  for (let i = 0; i < CUR_LEN; i++) {
    const b = load<u64>(CUR + (i << 3));
    acc ^= detect_LOW_ONLY(b) | (b & 0xff00_ff00_ff00_ff00);
  }
  blackbox(acc);
}
function bench_COMBINED(): void {
  let acc: u64 = 0;
  for (let i = 0; i < CUR_LEN; i++) {
    acc ^= detect_COMBINED(load<u64>(CUR + (i << 3)));
  }
  blackbox(acc);
}

// 4096 blocks × 8 bytes = 32 KB per pass. Ops chosen so a pass batch
// runs ~5s wall-time.
const OPS: u64 = 250_000;
const BYTES_PER_OP: u64 = <u64>N_BLOCKS * 8;

function runCorpus(name: string, ptr: usize): void {
  CUR = ptr;
  CUR_LEN = N_BLOCKS;

  bench("Detect SAFE (" + name + ")", bench_SAFE, OPS, BYTES_PER_OP);
  dumpToFile("swar-string-ser-detect-safe-" + name, "serialize");

  bench("Detect SAFE_BL (" + name + ")", bench_SAFE_BL, OPS, BYTES_PER_OP);
  dumpToFile("swar-string-ser-detect-safe-bl-" + name, "serialize");

  bench("Detect UNSAFE (" + name + ")", bench_UNSAFE, OPS, BYTES_PER_OP);
  dumpToFile("swar-string-ser-detect-unsafe-" + name, "serialize");

  bench("Detect LOW_ONLY (" + name + ")", bench_LOW_ONLY, OPS, BYTES_PER_OP);
  dumpToFile("swar-string-ser-detect-low-only-" + name, "serialize");

  bench("Detect COMBINED (" + name + ")", bench_COMBINED, OPS, BYTES_PER_OP);
  dumpToFile("swar-string-ser-detect-combined-" + name, "serialize");
}

runCorpus("plain", changetype<usize>(corpusPlain));
runCorpus("sparse", changetype<usize>(corpusSparse));
runCorpus("dense", changetype<usize>(corpusDense));
runCorpus("nonasc", changetype<usize>(corpusNonAsc));
