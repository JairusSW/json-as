// Head-to-head: AS std `itoa_buffered` vs a jeaiii-style forward-writing
// `u32_to_utf16`. The jeaiii algorithm (James Edward Anhalt III's
// integer-to-string) collapses `decimalCount` + backward-write into a
// single ladder of width comparisons that emits digits forward in one
// pass, with a 100-entry digit-pair LUT keyed on `value % 100`.
//
// References:
//   - https://github.com/jeaiii/itoa
//   - https://lemire.me/blog/2021/11/18/converting-integers-to-fix-digit-representations-quickly/
//
// The bench writes `N` u32 values into a scratch buffer for each
// implementation, then reports MB/s based on `bytes_emitted * 2` (UTF-16).

import { bench, blackbox, dumpToFile } from "../lib/bench";
import { itoa_buffered } from "util/number";

// ---------------------------------------------------------------------------
// 100-entry pair LUT: index `i` -> u32 holding the UTF-16 chars for the
// 2-digit string "DD" (zero-padded). Each entry is exactly 4 bytes, so a
// single `store<u32>` writes the pair.
// ---------------------------------------------------------------------------
const DIGIT_PAIRS_UTF16: usize = memory.data(100 * 4);
let _pairsInited: bool = false;

function initPairs(): void {
  for (let i: i32 = 0; i < 100; i++) {
    const tens = u32(0x30 + i / 10);
    const units = u32(0x30 + (i % 10));
    store<u32>(DIGIT_PAIRS_UTF16 + ((<usize>i) << 2), tens | (units << 16));
  }
  _pairsInited = true;
}


@inline function pair(i: u32): u32 {
  return load<u32>(DIGIT_PAIRS_UTF16 + ((<usize>i) << 2));
}

// ---------------------------------------------------------------------------
// jeaiii-style u32 -> UTF-16, forward write. Returns char count.
// Ladder of width buckets; each bucket emits its digits via the pair LUT
// (or a single `store<u16>` for odd-digit-count buckets). All `/` and `%`
// by 10 / 100 / 10000 are by constants, which the wasm tier lowers to
// multiply-shift, so there's no actual division on the hot path.
// ---------------------------------------------------------------------------
// @ts-expect-error: @inline is a valid decorator
@inline function jeaiii_u32_to_utf16(buf: usize, v: u32): u32 {
  if (v < 10) {
    store<u16>(buf, <u16>(v + 0x30));
    return 1;
  }
  if (v < 100) {
    store<u32>(buf, pair(v));
    return 2;
  }
  if (v < 1_000_000) {
    if (v < 10_000) {
      if (v < 1_000) {
        const h = v / 100;
        const l = v - h * 100;
        store<u16>(buf, <u16>(h + 0x30));
        store<u32>(buf, pair(l), 2);
        return 3;
      }
      const h = v / 100;
      const l = v - h * 100;
      store<u32>(buf, pair(h));
      store<u32>(buf, pair(l), 4);
      return 4;
    }
    if (v < 100_000) {
      const hi = v / 10_000;
      const rest = v - hi * 10_000;
      const m = rest / 100;
      const l = rest - m * 100;
      store<u16>(buf, <u16>(hi + 0x30));
      store<u32>(buf, pair(m), 2);
      store<u32>(buf, pair(l), 6);
      return 5;
    }
    const hi = v / 10_000;
    const rest = v - hi * 10_000;
    const m = rest / 100;
    const l = rest - m * 100;
    store<u32>(buf, pair(hi));
    store<u32>(buf, pair(m), 4);
    store<u32>(buf, pair(l), 8);
    return 6;
  }
  if (v < 100_000_000) {
    if (v < 10_000_000) {
      const top = v / 1_000_000;
      let rest = v - top * 1_000_000;
      const m = rest / 10_000;
      rest = rest - m * 10_000;
      const n = rest / 100;
      const l = rest - n * 100;
      store<u16>(buf, <u16>(top + 0x30));
      store<u32>(buf, pair(m), 2);
      store<u32>(buf, pair(n), 6);
      store<u32>(buf, pair(l), 10);
      return 7;
    }
    const top = v / 1_000_000;
    let rest = v - top * 1_000_000;
    const m = rest / 10_000;
    rest = rest - m * 10_000;
    const n = rest / 100;
    const l = rest - n * 100;
    store<u32>(buf, pair(top));
    store<u32>(buf, pair(m), 4);
    store<u32>(buf, pair(n), 8);
    store<u32>(buf, pair(l), 12);
    return 8;
  }
  // 9 or 10 digits. Split off the top digit (1 or 2 chars) then emit four
  // pair-LUT writes over the remaining 8 digits.
  if (v < 1_000_000_000) {
    const top = v / 100_000_000;
    let rest = v - top * 100_000_000;
    const a = rest / 1_000_000;
    rest = rest - a * 1_000_000;
    const b = rest / 10_000;
    rest = rest - b * 10_000;
    const c = rest / 100;
    const d = rest - c * 100;
    store<u16>(buf, <u16>(top + 0x30));
    store<u32>(buf, pair(a), 2);
    store<u32>(buf, pair(b), 6);
    store<u32>(buf, pair(c), 10);
    store<u32>(buf, pair(d), 14);
    return 9;
  }
  const top = v / 100_000_000;
  let rest = v - top * 100_000_000;
  const a = rest / 1_000_000;
  rest = rest - a * 1_000_000;
  const b = rest / 10_000;
  rest = rest - b * 10_000;
  const c = rest / 100;
  const d = rest - c * 100;
  store<u32>(buf, pair(top));
  store<u32>(buf, pair(a), 4);
  store<u32>(buf, pair(b), 8);
  store<u32>(buf, pair(c), 12);
  store<u32>(buf, pair(d), 16);
  return 10;
}

// ---------------------------------------------------------------------------
// Inputs: corpora of u32 values at each width 1..10. Each corpus has the
// same byte budget (~256 KiB worth of u32 values) so the bench-loop count
// is comparable across widths.
// ---------------------------------------------------------------------------

function buildAt(width: i32, count: i32, seed: u32): StaticArray<u32> {
  const out = new StaticArray<u32>(count);
  let lo: u32 = 1;
  for (let k: i32 = 1; k < width; k++) lo *= 10;
  let hi = lo * 10 - 1;
  // Trim to u32 max for width 10.
  if (width == 10) hi = u32.MAX_VALUE;
  if (width == 1) lo = 0;
  const range = hi - lo + 1;
  let r = seed;
  for (let i: i32 = 0; i < count; i++) {
    // xorshift32 — enough for benchmark variety.
    r ^= r << 13;
    r ^= r >> 17;
    r ^= r << 5;
    out[i] = lo + (r % range);
  }
  return out;
}

const WIDTHS: i32[] = [1, 2, 4, 6, 8, 10];
const PER_WIDTH: i32 = 200_000;
const corpora: StaticArray<u32>[] = [];
for (let i: i32 = 0; i < WIDTHS.length; i++) {
  corpora.push(
    buildAt(
      unchecked(WIDTHS[i]),
      PER_WIDTH,
      u32(0xdead_beef ^ unchecked(WIDTHS[i])),
    ),
  );
}

// Scratch buffer big enough for any single value (10 digits * 2 bytes).
const SCRATCH: usize = memory.data(64);

// Ensure pairs are populated before either fast path runs.
initPairs();

// ---------------------------------------------------------------------------
// Bench loops.
// ---------------------------------------------------------------------------

let CUR_PTR: usize = 0;
let CUR_LEN: i32 = 0;

function runStd(): void {
  let bytes: u32 = 0;
  const ptr = CUR_PTR;
  for (let i: i32 = 0; i < CUR_LEN; i++) {
    const v = load<u32>(ptr + ((<usize>i) << 2));
    bytes += itoa_buffered<u32>(SCRATCH, v);
  }
  blackbox(bytes);
}

function runJeaiii(): void {
  let bytes: u32 = 0;
  const ptr = CUR_PTR;
  for (let i: i32 = 0; i < CUR_LEN; i++) {
    const v = load<u32>(ptr + ((<usize>i) << 2));
    bytes += jeaiii_u32_to_utf16(SCRATCH, v);
  }
  blackbox(bytes);
}

// ---------------------------------------------------------------------------
// Run the head-to-head per digit width. `bytes` reports the total digit
// count emitted per outer iteration (UTF-16 bytes), so MB/s reflects the
// formatting throughput, not just the input scan.
// ---------------------------------------------------------------------------
const OPS: u64 = 200;
for (let i: i32 = 0; i < WIDTHS.length; i++) {
  const w = unchecked(WIDTHS[i]);
  const corpus = unchecked(corpora[i]);
  CUR_PTR = changetype<usize>(corpus);
  CUR_LEN = corpus.length;
  // bytes per outer iter = elements * (digits * 2 bytes UTF-16)
  const bytesPerOp = <u64>CUR_LEN * <u64>(w * 2);

  bench("itoa STD u32 (" + w.toString() + "d)", runStd, OPS, bytesPerOp);
  dumpToFile("itoa-h2h-std-u32-" + w.toString(), "format");

  bench("itoa NEW u32 (" + w.toString() + "d)", runJeaiii, OPS, bytesPerOp);
  dumpToFile("itoa-h2h-new-u32-" + w.toString(), "format");
}
