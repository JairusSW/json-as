// Head-to-head: SIMD integer parsers inspired by Lemire's work.
//
// Three approaches compared:
//
//   1. PROD-8 — the production SIMD 8-digit parser already in
//      assembly/deserialize/simd/array/integer.ts, copied verbatim. It uses
//      i8x16.narrow → i16x8.extmul → i32x4.extadd_pairwise → i16x8.narrow →
//      i32x4.dot_i16x8_s (Lemire-style pack-and-dot).
//
//   2. NEW-16 — Lemire's "wider is better": one call processes 16 UTF-16
//      digits (32 source bytes) by issuing two parallel SIMD pipelines that
//      feed into a single combine. Halves the per-call loop overhead for
//      long integers.
//
//   3. SWAR-8 — the SWAR PairMul baseline from swar-int.ts for reference.
//
// The bench focuses on the inner kernel (one call's amortized cost) and on
// end-to-end atoi at realistic JSON widths (8/16/24/32 digits — covering
// u32, u64-near, and beyond).

import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { bench, blackbox, dumpToFile } from "../lib/bench";
import { expect } from "../../__tests__/lib";
import {
  parse4Digits_PairMul,
  parse8Digits_PairMul,
} from "../../util/swar-int";

// @ts-expect-error: @lazy
@lazy const SPLAT_30 = i16x8.splat(0x30);
// @ts-expect-error: @lazy
@lazy const SPLAT_09 = i16x8.splat(9);
// @ts-expect-error: @lazy
@lazy const ZERO_I16X8 = i16x8.splat(0);
// @ts-expect-error: @lazy
@lazy const ZERO_I32X4 = i32x4.splat(0);
// @ts-expect-error: @lazy
@lazy const PACK_WEIGHTS_10_1 = i8x16(
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
);
// @ts-expect-error: @lazy
@lazy const PACK_WEIGHTS_10_1_FULL = i8x16(
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
);
// @ts-expect-error: @lazy
@lazy const PAIR_WEIGHTS_100_1 = i16x8(100, 1, 100, 1, 0, 0, 0, 0);
// @ts-expect-error: @lazy
@lazy const PAIR_WEIGHTS_100_1_FULL = i16x8(100, 1, 100, 1, 100, 1, 100, 1);

// ---------------------------------------------------------------------------
// PROD-8 — verbatim copy of tryParseEightDigitsSIMD from the project.
// Returns parse_value or U32.MAX_VALUE on invalid input. (The original
// returns 0 on invalid; we adapt to a sentinel-or-value contract here.)
// ---------------------------------------------------------------------------
// @ts-expect-error: @inline
@inline function parse8Digits_SIMD_Prod(srcStart: usize): u32 {
  const block = load<v128>(srcStart);
  const digits = i16x8.sub(block, SPLAT_30);
  if (v128.any_true(i16x8.gt_u(digits, SPLAT_09))) return U32.MAX_VALUE;

  const packed = i8x16.narrow_i16x8_u(digits, ZERO_I16X8);
  const products = i16x8.extmul_low_i8x16_u(packed, PACK_WEIGHTS_10_1);
  const pairs = i32x4.extadd_pairwise_i16x8_u(products);
  const pairs16 = i16x8.narrow_i32x4_u(pairs, ZERO_I32X4);
  const groups = i32x4.dot_i16x8_s(pairs16, PAIR_WEIGHTS_100_1);

  const lo = i32x4.extract_lane(groups, 0);
  const hi = i32x4.extract_lane(groups, 1);
  return <u32>lo * 10000 + <u32>hi;
}

// ---------------------------------------------------------------------------
// NEW-16 — process 16 UTF-16 digits per call. Two parallel pipelines.
// Returns u64 value, or 0 on invalid (sentinel handling via separate flag).
// ---------------------------------------------------------------------------
// @ts-expect-error: @inline
@inline function parse16Digits_SIMD_Wide(srcStart: usize): u64 {
  const block0 = load<v128>(srcStart);
  const block1 = load<v128>(srcStart, 16);

  // Subtract '0' from each UTF-16 lane (8 lanes per block).
  const digits0 = i16x8.sub(block0, SPLAT_30);
  const digits1 = i16x8.sub(block1, SPLAT_30);

  // Single OR'd validation across both halves.
  const bad0 = i16x8.gt_u(digits0, SPLAT_09);
  const bad1 = i16x8.gt_u(digits1, SPLAT_09);
  if (v128.any_true(v128.or(bad0, bad1))) return U64.MAX_VALUE;

  // Pack both halves into one v128 with 16 packed ASCII digits.
  const packed = i8x16.narrow_i16x8_u(digits0, digits1);

  // Stage 1: digit × (10,1,10,1,...) per lane. extmul_low takes packed lanes
  // 0..7, extmul_high takes lanes 8..15. Each yields u16x8 lane values
  // alternating (10*d_even, d_odd).
  const products_lo = i16x8.extmul_low_i8x16_u(packed, PACK_WEIGHTS_10_1_FULL);
  const products_hi = i16x8.extmul_high_i8x16_u(packed, PACK_WEIGHTS_10_1_FULL);

  // Stage 2: pair-sum adjacent u16 lanes into u32 lanes → 4 two-digit values
  // per half (in [0..99]).
  const pairs_lo = i32x4.extadd_pairwise_i16x8_u(products_lo);
  const pairs_hi = i32x4.extadd_pairwise_i16x8_u(products_hi);

  // Stage 3: narrow both u32x4 results to a single u16x8 holding the 8 pair
  // values, then dot-product with (100,1,100,1,100,1,100,1) to fold each
  // adjacent pair into a 4-digit group.
  const pairs16 = i16x8.narrow_i32x4_u(pairs_lo, pairs_hi);
  const groups = i32x4.dot_i16x8_s(pairs16, PAIR_WEIGHTS_100_1_FULL);

  // groups lanes: g0=digits 0..3, g1=digits 4..7, g2=digits 8..11, g3=digits 12..15.
  const g0 = i32x4.extract_lane(groups, 0);
  const g1 = i32x4.extract_lane(groups, 1);
  const g2 = i32x4.extract_lane(groups, 2);
  const g3 = i32x4.extract_lane(groups, 3);
  // Parallel pairs: pair01 = g0*1e4+g1 (digits 0..7), pair23 = g2*1e4+g3
  // (digits 8..15). Both are independent and can be issued together.
  const pair01 = <u64>g0 * 10_000 + <u64>g1;
  const pair23 = <u64>g2 * 10_000 + <u64>g3;
  return pair01 * 100_000_000 + pair23;
}

// ---------------------------------------------------------------------------
// Test corpora.
// ---------------------------------------------------------------------------

function buildDigits(n: i32): string {
  let s = "";
  while (s.length < n) s += "1234567890";
  return s.substring(0, n);
}

const D8 = buildDigits(8);
const D16 = buildDigits(16);
const D24 = buildDigits(24);
const D32 = buildDigits(32);
const D64 = buildDigits(64);

// ---------------------------------------------------------------------------
// Correctness gate.
// ---------------------------------------------------------------------------

function verify(): void {
  // 8 digits: PROD-8 should match SWAR parse8.
  const p8 = changetype<usize>(D8);
  const prod8 = parse8Digits_SIMD_Prod(p8);
  const swar8 = parse8Digits_PairMul(load<u64>(p8), load<u64>(p8, 8));
  expect<u32>(prod8).toBe(swar8);

  // 16 digits: NEW-16 should equal "parse first 8 * 1e8 + parse next 8".
  const p16 = changetype<usize>(D16);
  const new16 = parse16Digits_SIMD_Wide(p16);
  const lo = <u64>parse8Digits_SIMD_Prod(p16);
  const hi = <u64>parse8Digits_SIMD_Prod(p16 + 16);
  const expected = lo * 100_000_000 + hi;
  expect<u64>(new16).toBe(expected);
}

verify();

// ---------------------------------------------------------------------------
// Atoi end-to-end variants for each parser.
// ---------------------------------------------------------------------------

// PROD-8: stride 16 bytes per iter.
// @ts-expect-error: @inline
@inline function atoi_Prod8(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 14 < srcEnd) {
    const parsed = parse8Digits_SIMD_Prod(srcStart);
    if (parsed == U32.MAX_VALUE) break;
    value = value * 100_000_000 + parsed;
    srcStart += 16;
  }
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_PairMul(load<u64>(srcStart));
    if (parsed == U32.MAX_VALUE) break;
    value = value * 10_000 + parsed;
    srcStart += 8;
  }
  while (srcStart < srcEnd) {
    const digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }
  return value;
}

// NEW-16: stride 32 bytes per iter.
// @ts-expect-error: @inline
@inline function atoi_New16(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 30 < srcEnd) {
    const parsed = parse16Digits_SIMD_Wide(srcStart);
    if (parsed == U64.MAX_VALUE) break;
    value = value * 10_000_000_000_000_000 + parsed;
    srcStart += 32;
  }
  while (srcStart + 14 < srcEnd) {
    const parsed = parse8Digits_SIMD_Prod(srcStart);
    if (parsed == U32.MAX_VALUE) break;
    value = value * 100_000_000 + parsed;
    srcStart += 16;
  }
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_PairMul(load<u64>(srcStart));
    if (parsed == U32.MAX_VALUE) break;
    value = value * 10_000 + parsed;
    srcStart += 8;
  }
  while (srcStart < srcEnd) {
    const digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }
  return value;
}

// Cross-check atoi variants on long inputs.
function verifyAtoi(): void {
  const inputs: string[] = [D16, D24, D32, D64];
  for (let i = 0; i < inputs.length; i++) {
    const v = unchecked(inputs[i]);
    const p = changetype<usize>(v);
    const e = p + ((<usize>v.length) << 1);
    const a = atoi_Prod8(p, e);
    const b = atoi_New16(p, e);
    expect<u64>(b).toBe(a);
  }
}

verifyAtoi();

// ---------------------------------------------------------------------------
// Bench routines.
// ---------------------------------------------------------------------------

let CUR_PTR: usize = 0;
let CUR_END: usize = 0;

function kernel_Prod8(): void {
  blackbox(parse8Digits_SIMD_Prod(CUR_PTR));
  blackbox(parse8Digits_SIMD_Prod(CUR_PTR));
  blackbox(parse8Digits_SIMD_Prod(CUR_PTR));
  blackbox(parse8Digits_SIMD_Prod(CUR_PTR));
}
function kernel_New16(): void {
  blackbox(parse16Digits_SIMD_Wide(CUR_PTR));
  blackbox(parse16Digits_SIMD_Wide(CUR_PTR));
  blackbox(parse16Digits_SIMD_Wide(CUR_PTR));
  blackbox(parse16Digits_SIMD_Wide(CUR_PTR));
}
function atoi_Prod8_bench(): void {
  blackbox(atoi_Prod8(CUR_PTR, CUR_END));
}
function atoi_New16_bench(): void {
  blackbox(atoi_New16(CUR_PTR, CUR_END));
}

// Kernel benches.
CUR_PTR = changetype<usize>(D16);
const KERNEL_OPS: u64 = 40_000_000;
bench("Kernel parse8 PROD (16B input)", kernel_Prod8, KERNEL_OPS, 16 * 4);
dumpToFile("simd-int-parse-h2h-kernel-prod8", "parse");
bench("Kernel parse16 NEW (32B input)", kernel_New16, KERNEL_OPS, 32 * 4);
dumpToFile("simd-int-parse-h2h-kernel-new16", "parse");

// Atoi benches across widths.
const widths: i32[] = [8, 16, 24, 32, 64];
for (let i = 0; i < widths.length; i++) {
  const w = unchecked(widths[i]);
  let v: string;
  if (w == 8) v = D8;
  else if (w == 16) v = D16;
  else if (w == 24) v = D24;
  else if (w == 32) v = D32;
  else v = D64;

  CUR_PTR = changetype<usize>(v);
  CUR_END = CUR_PTR + ((<usize>v.length) << 1);
  const ops: u64 = 20_000_000;

  bench(
    "Atoi PROD-8 (" + w.toString() + "d)",
    atoi_Prod8_bench,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("simd-int-parse-h2h-atoi-prod8-" + w.toString(), "parse");

  bench(
    "Atoi NEW-16 (" + w.toString() + "d)",
    atoi_New16_bench,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("simd-int-parse-h2h-atoi-new16-" + w.toString(), "parse");
}
