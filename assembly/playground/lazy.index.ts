/// <reference path="../index.d.ts" />

// ---------------------------------------------------------------------------
// Structural-index variant — port of simdjson "Stage 1"
// ---------------------------------------------------------------------------
//
// From Langdale & Lemire, "Parsing Gigabytes of JSON per Second"
// (arXiv:1902.08318). Where the on-demand cursor in `lazy.ts` scans to the next
// structural character *on the fly*, this variant does ONE branchless pass that
// builds an index of every structural position up front; navigation then walks
// the index instead of re-scanning bytes. (PLAN Phase 6.)
//
// The pass processes the document in 64-character windows. For each window it
// builds three 64-bit bitmasks (quotes, backslashes, structural set) from eight
// `i16x8` SIMD compares, then applies the paper's branchless bit-tricks:
//
//   1. find_escaped (Fig 3)  — remove quotes/chars escaped by an odd-length
//      backslash run, carrying run state across windows.
//   2. quoted range  (Fig 4) — R = prefix-XOR(unescaped quotes) marks bytes
//      inside strings (open quote + content, excluding the close). The paper
//      uses a carry-less multiply; WASM SIMD has none, so we use the equivalent
//      log-shift prefix-XOR. The "currently inside a string" bit carries across
//      windows by XOR-ing the broadcast of the previous window's top bit.
//   3. structural    (Fig 5) — keep structural chars OUTSIDE strings, plus each
//      string's OPENING quote: (structural & ~R) | (quotes & R).
//   4. extraction    (Fig 6) — ctz/blsr the result bitmask into offsets.
//
// Index contents (well-defined, matched by `buildIndexOracle`): the code-unit
// offset of every `{ } [ ] : ,` outside a string, and of every string's opening
// `"`. Close quotes and atom interiors are not indexed (atoms sit in the short
// gap between two index entries). Requires `--enable simd`.

// 64-char (128-byte) scratch for the padded final window — built once.
// @ts-ignore: decorator valid here
@lazy const TAIL: StaticArray<u16> = new StaticArray<u16>(64);

// @ts-ignore: decorator valid here
@inline const EVEN_BITS: u64 = 0x5555555555555555; // 1s at even bit indices

// @ts-ignore: decorator valid here
@lazy const X_QUOTE: v128 = i16x8.splat(0x22); // "
// @ts-ignore: decorator valid here
@lazy const X_BSL: v128 = i16x8.splat(0x5c); // \
// @ts-ignore: decorator valid here
@lazy const X_LB: v128 = i16x8.splat(0x7b); // {
// @ts-ignore: decorator valid here
@lazy const X_RB: v128 = i16x8.splat(0x7d); // }
// @ts-ignore: decorator valid here
@lazy const X_LK: v128 = i16x8.splat(0x5b); // [
// @ts-ignore: decorator valid here
@lazy const X_RK: v128 = i16x8.splat(0x5d); // ]
// @ts-ignore: decorator valid here
@lazy const X_COL: v128 = i16x8.splat(0x3a); // :
// @ts-ignore: decorator valid here
@lazy const X_COM: v128 = i16x8.splat(0x2c); // ,

/** 8-bit submask: which of a v128's 8 u16 lanes is a structural char. */
// @ts-ignore: decorator valid here
@inline function structuralSub(b: v128): u32 {
  return i16x8.bitmask(
    v128.or(
      v128.or(
        v128.or(i16x8.eq(b, X_LB), i16x8.eq(b, X_RB)),
        v128.or(i16x8.eq(b, X_LK), i16x8.eq(b, X_RK)),
      ),
      v128.or(i16x8.eq(b, X_COL), i16x8.eq(b, X_COM)),
    ),
  );
}

/** Inclusive prefix-XOR of a 64-bit mask (Fig 4 without carry-less multiply). */
// @ts-ignore: decorator valid here
@inline function prefixXor(x: u64): u64 {
  x ^= x << 1;
  x ^= x << 2;
  x ^= x << 4;
  x ^= x << 8;
  x ^= x << 16;
  x ^= x << 32;
  return x;
}

/**
 * Build the structural index of `src`. Returns a right-sized `StaticArray<u32>`
 * of code-unit offsets (see file header for exact contents).
 */
export function buildIndex(src: string): StaticArray<u32> {
  const start = changetype<usize>(src);
  const n = src.length;
  const tmp = new StaticArray<u32>(n ? n : 1); // worst case: every char structural
  let count = 0;

  let prevInside: u64 = 0; // all-ones if the previous window ended inside a string
  let prevEscaped: u64 = 0; // find_escaped carry (bit 0 = first char escaped)

  let base = start;
  let charIdx = 0;
  while (charIdx < n) {
    const remaining = n - charIdx;
    let p: usize;
    let valid: i32;
    if (remaining >= 64) {
      p = base;
      valid = 64;
    } else {
      // copy the tail into a space-padded window so the SIMD path still applies
      for (let k = 0; k < 64; k++) {
        unchecked(
          (TAIL[k] =
            k < remaining ? load<u16>(base + ((<usize>k) << 1)) : 0x20),
        );
      }
      p = changetype<usize>(TAIL);
      valid = remaining;
    }

    // --- build the three 64-bit masks from 8 SIMD blocks --------------------
    let quote: u64 = 0;
    let bsl: u64 = 0;
    let st: u64 = 0;
    for (let j = 0; j < 8; j++) {
      const b = load<v128>(p + ((<usize>j) << 4));
      const shift = j << 3; // j * 8
      quote |= (<u64>i16x8.bitmask(i16x8.eq(b, X_QUOTE))) << shift;
      bsl |= (<u64>i16x8.bitmask(i16x8.eq(b, X_BSL))) << shift;
      st |= (<u64>structuralSub(b)) << shift;
    }

    // --- 1. escaped chars (Fig 3 / simdjson find_escaped) -------------------
    let escaped: u64;
    if (bsl == 0) {
      escaped = prevEscaped;
      prevEscaped = 0;
    } else {
      bsl &= ~prevEscaped;
      const followsEscape = (bsl << 1) | prevEscaped;
      const oddStarts = bsl & ~EVEN_BITS & ~followsEscape;
      const sum = oddStarts + bsl; // wraps; carry-out below
      prevEscaped = sum < oddStarts ? 1 : 0;
      const invert = sum << 1;
      escaped = (EVEN_BITS ^ invert) & followsEscape;
    }

    // --- 2. quoted range R (Fig 4) ------------------------------------------
    const qReal = quote & ~escaped;
    const R = prefixXor(qReal) ^ prevInside;
    prevInside = <u64>((<i64>R) >> 63); // broadcast the top bit (sign shift)

    // --- 3. structural + opening quotes (Fig 5, our index definition) -------
    let mask = (st & ~R) | (qReal & R);
    if (valid < 64) mask &= ((<u64>1) << valid) - 1; // drop padding bits

    // --- 4. extract offsets (Fig 6) -----------------------------------------
    while (mask) {
      unchecked((tmp[count++] = <u32>(charIdx + <i32>ctz(mask))));
      mask &= mask - 1; // blsr: clear lowest set bit
    }

    charIdx += 64;
    base += 128;
  }

  const out = new StaticArray<u32>(count);
  for (let i = 0; i < count; i++) unchecked((out[i] = unchecked(tmp[i])));
  return out;
}

/**
 * Scalar reference: walks char-by-char tracking in-string + escape state and
 * records the same positions `buildIndex` should. The equivalence oracle.
 */
export function buildIndexOracle(src: string): StaticArray<u32> {
  const start = changetype<usize>(src);
  const n = src.length;
  const tmp = new StaticArray<u32>(n ? n : 1);
  let count = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < n; i++) {
    const c = load<u16>(start + ((<usize>i) << 1));
    if (inString) {
      if (escaped) escaped = false;
      else if (c == 0x5c) escaped = true;
      else if (c == 0x22) inString = false;
      continue;
    }
    if (c == 0x22) {
      unchecked((tmp[count++] = i)); // opening quote
      inString = true;
    } else if (
      c == 0x7b ||
      c == 0x7d ||
      c == 0x5b ||
      c == 0x5d ||
      c == 0x3a ||
      c == 0x2c
    ) {
      unchecked((tmp[count++] = i));
    }
  }
  const out = new StaticArray<u32>(count);
  for (let i = 0; i < count; i++) unchecked((out[i] = unchecked(tmp[i])));
  return out;
}

/** True if two index arrays are identical (length + every element). */
export function indexEq(a: StaticArray<u32>, b: StaticArray<u32>): bool {
  if (a.length != b.length) return false;
  for (let i = 0; i < a.length; i++)
    if (unchecked(a[i]) != unchecked(b[i])) return false;
  return true;
}
