// Fast integer -> UTF-16 stringification.
//
// We tried the "real" jeaiii algorithm (fixed-point magic-multiplication
// per bucket; `f0 -> f2 -> f4 -> f6` chained fractional-part extractions)
// and it ran ~5-7% slower on V8/wasm than the div-by-constant variant
// below. Two reasons:
//
//   1. V8/wasm lowers `v / 100` (and other `/ <const>`s) to a single
//      multiply-shift, so jeaiii's main selling point — avoiding division
//      hardware — gives no win on this target. The op counts come out
//      roughly equal.
//
//   2. The div-by-const variant computes each digit pair independently
//      from `v` (`h = v / 100`, `l = v - h*100`, etc), so V8 schedules
//      the LUT loads + stores for all pairs in parallel. The jeaiii
//      chain forces them serial.
//
// What we keep from jeaiii here:
//
//   - Width-ladder dispatch (`if v < 100 / 10_000 / 1_000_000 / ...`) so
//     the same comparisons that would drive a separate `decimalCount`
//     pass become the bucket pick.
//
//   - A 100-entry digit-pair LUT keyed on `value % 100`. One `store<u32>`
//     emits a UTF-16 pair.
//
//   - Forward write in one pass — no `decimalCount32` precomputation, no
//     backward write.
//
// Reference H2H bench: `__benches__/custom/itoa-h2h.bench.ts`.

// 100-entry pair LUT: index `i` -> u32 holding UTF-16 chars for the
// zero-padded two-digit string "DD". One `store<u32>` writes the pair.
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

export function ensureItoaPairs(): void {
  if (!_pairsInited) initPairs();
}

function pair(i: u32): u32 {
  return load<u32>(DIGIT_PAIRS_UTF16 + ((<usize>i) << 2));
}

/**
 * u32 -> UTF-16 stringification, forward write.
 * Returns the number of UTF-16 chars written (caller multiplies by 2 for
 * a byte offset). Caller must ensure the buffer has at least 20 bytes
 * available (max 10 chars).
 */
export function itoaU32(buf: usize, v: u32): u32 {
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

/**
 * Writes a u32 in the range 0..99_999_999 as exactly 8 UTF-16 chars with
 * leading zeros. Used by the u64 path to emit trailing groups of 8 digits.
 */
function writeU32Padded8(buf: usize, v: u32): void {
  const a = v / 1_000_000;
  let rest = v - a * 1_000_000;
  const b = rest / 10_000;
  rest = rest - b * 10_000;
  const c = rest / 100;
  const d = rest - c * 100;
  store<u32>(buf, pair(a));
  store<u32>(buf, pair(b), 4);
  store<u32>(buf, pair(c), 8);
  store<u32>(buf, pair(d), 12);
}

/**
 * u64 -> UTF-16 stringification.
 * Small values delegate to `itoaU32`. For 11+ digit values, peel 8 digits
 * from the bottom (always fits in u32), emit the remaining top via the
 * u32 path, then emit the 8 trailing digits with leading-zero padding.
 * For 17+ digit values (which still fit in u64 < 1.8e19), repeat.
 * Caller must ensure the buffer has at least 40 bytes available.
 */
export function itoaU64(buf: usize, v: u64): u32 {
  if (v <= <u64>u32.MAX_VALUE) {
    return itoaU32(buf, <u32>v);
  }
  const lo8 = <u32>(v % 100_000_000);
  const hi = v / 100_000_000;
  if (hi <= <u64>u32.MAX_VALUE) {
    const written = itoaU32(buf, <u32>hi);
    writeU32Padded8(buf + ((<usize>written) << 1), lo8);
    return written + 8;
  }
  // 17-20 digit case: peel a second group of 8.
  const mid8 = <u32>(hi % 100_000_000);
  const top = <u32>(hi / 100_000_000);
  const written = itoaU32(buf, top);
  writeU32Padded8(buf + ((<usize>written) << 1), mid8);
  writeU32Padded8(buf + ((<usize>written) << 1) + 16, lo8);
  return written + 16;
}

/**
 * Generic integer -> UTF-16 entry point. Signed types peel `-` and pass
 * the absolute value (via two's complement negation, which works for the
 * minimum-value edge case because `u32(-i32.MIN_VALUE) == 2147483648`
 * and likewise for i64).
 *
 * Returns the number of UTF-16 chars written.
 */
export function itoaFast<T extends number>(buf: usize, value: T): u32 {
  if (sizeof<T>() <= 4) {
    if (isSigned<T>()) {
      let v = <i32>value;
      if (v < 0) {
        store<u16>(buf, 0x2d); // '-'
        return 1 + itoaU32(buf + 2, <u32>-v);
      }
      return itoaU32(buf, <u32>v);
    }
    return itoaU32(buf, <u32>value);
  }
  if (isSigned<T>()) {
    let v = <i64>value;
    if (v < 0) {
      store<u16>(buf, 0x2d); // '-'
      return 1 + itoaU64(buf + 2, <u64>-v);
    }
    return itoaU64(buf, <u64>value);
  }
  return itoaU64(buf, <u64>value);
}
