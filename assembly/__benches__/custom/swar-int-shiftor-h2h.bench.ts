// Head-to-head: the (blockA << 8) | blockB merge trick.
//
// User's question: instead of the 22-op SWAR packing of 2× UTF-16 u64 → 1×
// ASCII u64, can we just do `(blockA << 8) | blockB`?
//
// Discovery: that 2-op trick does NOT concatenate; it INTERLEAVES. For
// blockA = "1234" and blockB = "5678" the result bytes are (5,1,6,2,7,3,8,4)
// rather than (1,2,3,4,5,6,7,8). Standard Lemire on this layout produces a
// scrambled value (5*10^7+1*10^6+...). To get the desired answer we have to
// either (a) un-interleave back into two spread blocks (which costs us the
// savings we just gained), or (b) write a custom magic-mul that reads the
// interleaved layout directly.
//
// This file benches both: the un-merge approach and a custom interleaved
// magic-mul combine. Compare against the current parse8Digits_PairMul.

import { bench, blackbox, dumpToFile } from "../lib/bench";
import { expect } from "../../__tests__/lib";
import { parse8Digits_PairMul } from "../../util/swar-int";

const LANE_HI_4: u64 = 0xff00_ff00_ff00_ff00;
const LANE_LO_4: u64 = 0x00ff_00ff_00ff_00ff;
const ZERO_8: u64 = 0x3030_3030_3030_3030;
const DIGIT_TEST_ADD: u64 = 0x7676_7676_7676_7676;
const HIGH_BIT_8: u64 = 0x8080_8080_8080_8080;
const U32_LO_PAIR: u64 = 0x0000_ffff_0000_ffff;
// 1 + (100 << 32) - places ab*100 + cd in high 32 of u64 product.
const FINAL_4_MAGIC: u64 = 0x0000_0064_0000_0001;

// ---------------------------------------------------------------------------
// VARIANT A - merge with (blockA << 8) | blockB, then un-merge to recover
// the two original spread blocks, then apply parse4 to each.
//
// This is the user's idea taken to a correct end. Net op count is HIGHER
// than just doing parse4 on each block directly (the merge+unmerge step is
// wasted work).
// ---------------------------------------------------------------------------
// @ts-expect-error: @inline
@inline function parse8Digits_MergeUnmerge(blockA: u64, blockB: u64): u32 {
  // Validate high bytes are 0 (ASCII range) on both blocks.
  if (((blockA | blockB) & LANE_HI_4) != 0) return U32.MAX_VALUE;

  // User's merge - interleaves the two blocks' low bytes.
  const merged = (blockA << 8) | blockB;
  const val = merged - ZERO_8;

  // Validate every byte is a digit.
  if ((((val + DIGIT_TEST_ADD) | val) & HIGH_BIT_8) != 0) return U32.MAX_VALUE;

  // Un-interleave back into spread blockA / blockB layout.
  //   even bytes (0,2,4,6) carry blockB's digits → bDigits is already a
  //   "spread" u64 with digit values at lanes 0..3.
  //   odd bytes (1,3,5,7) carry blockA's digits → shift right 8 to align.
  const bDigits = val & LANE_LO_4;
  const aDigits = (val >> 8) & LANE_LO_4;

  // parse4 on each (magic-mul Lemire-style).
  const aPairs = (aDigits * 10 + (aDigits >> 16)) & U32_LO_PAIR;
  const bPairs = (bDigits * 10 + (bDigits >> 16)) & U32_LO_PAIR;
  const aVal = <u32>((aPairs * FINAL_4_MAGIC) >> 32);
  const bVal = <u32>((bPairs * FINAL_4_MAGIC) >> 32);
  return aVal * 10_000 + bVal;
}

// ---------------------------------------------------------------------------
// VARIANT B - merge, then a CUSTOM magic-mul that reads the interleaved
// layout directly.
//
// After merge + subtract '0', we have pair-fold producing:
//   P0 = 10*B0 + A0
//   P1 = 10*B1 + A1
//   P2 = 10*B2 + A2
//   P3 = 10*B3 + A3
// where A_i is blockA's digit at position i (i=0 → byte 0 of blockA → first
// char) and B_i is blockB's digit at i.
//
// Desired final result for the 8-digit string "A0 A1 A2 A3 B0 B1 B2 B3":
//   R = A0*10^7 + A1*10^6 + A2*10^5 + A3*10^4 + B0*10^3 + B1*10^2 + B2*10 + B3
//     = (A0*1000 + A1*100 + A2*10 + A3) * 10^4 + (B0*1000 + B1*100 + B2*10 + B3)
//
// Decomposing: we want to extract A_i and B_i contributions from each pair
// P_i with different weights. Since each P_i is 10*B_i + A_i, we can compute
//   A_part = sum_i A_i * 10^(7-i) = sum_i (P_i - 10*B_i) * 10^(7-i)
//   B_part = sum_i B_i * 10^(3-i)
// - but separating A_i from B_i in a single P_i requires either mod/div or
// a second multiplication on the pair word. The cleanest expression I could
// find still needs the un-interleave from variant A. Implementing it here
// just to confirm empirically.
//
// (Falls back to the same un-merge.)
// ---------------------------------------------------------------------------
// We don't have a working "magic-mul on interleaved" form - it requires
// non-uniform per-pair weights that don't factor cleanly into a single
// constant. Skipping this variant.

// ---------------------------------------------------------------------------
// VARIANT C - Same merge but apply STANDARD Lemire-8-byte to compute the
// SCRAMBLED interleaved value. This is what naively running Lemire on the
// user's merge produces. Result is WRONG (for "12345678" it yields
// 51_627_384), but it's the cheapest possible "merge + 8-byte combine".
// ---------------------------------------------------------------------------
// @ts-expect-error: @inline
@inline function parse8Digits_MergeWrong(blockA: u64, blockB: u64): u32 {
  if (((blockA | blockB) & LANE_HI_4) != 0) return U32.MAX_VALUE;
  const merged = (blockA << 8) | blockB;
  const val = merged - ZERO_8;
  if ((((val + DIGIT_TEST_ADD) | val) & HIGH_BIT_8) != 0) return U32.MAX_VALUE;
  // Lemire's 8-byte combine on the (interleaved) bytes.
  const v1 = (val * 10 + (val >> 8)) & LANE_LO_4;
  const LEMIRE_MAGIC_EVEN: u64 = 100 + (1_000_000 << 32);
  const LEMIRE_MAGIC_ODD: u64 = 1 + (10_000 << 32);
  const INNER_MASK: u64 = 0x0000_00ff_0000_00ff;
  const result =
    ((v1 & INNER_MASK) * LEMIRE_MAGIC_EVEN +
      ((v1 >> 16) & INNER_MASK) * LEMIRE_MAGIC_ODD) >>
    32;
  return <u32>result;
}

// ---------------------------------------------------------------------------
// Verify.
// ---------------------------------------------------------------------------

function pack4(s: string): u64 {
  let block: u64 = 0;
  for (let i = 0; i < 4; i++) block |= (<u64>s.charCodeAt(i)) << (<u64>i * 16);
  return block;
}

function verify(): void {
  // MergeUnmerge must agree with PairMul on valid 8-digit inputs.
  const probes: u32[] = [0, 1, 12345678, 99999999, 87654321];
  for (let i = 0; i < probes.length; i++) {
    const n = unchecked(probes[i]);
    let s = n.toString();
    while (s.length < 8) s = "0" + s;
    const a = pack4(s.substring(0, 4));
    const b = pack4(s.substring(4, 8));
    expect<u32>(parse8Digits_MergeUnmerge(a, b)).toBe(
      parse8Digits_PairMul(a, b),
    );
  }

  // MergeWrong: demonstrate that for "12345678" it gives 51_627_384.
  const a = pack4("1234");
  const b = pack4("5678");
  expect<u32>(parse8Digits_PairMul(a, b)).toBe(<u32>12_345_678);
  expect<u32>(parse8Digits_MergeWrong(a, b)).toBe(<u32>51_627_384);
}

verify();

// ---------------------------------------------------------------------------
// Atoi variants.
// ---------------------------------------------------------------------------

function buildDigits(n: i32): string {
  let s = "";
  while (s.length < n) s += "1234567890";
  return s.substring(0, n);
}
const D8 = buildDigits(8);
const D16 = buildDigits(16);
const D32 = buildDigits(32);
const D64 = buildDigits(64);

// @ts-expect-error: @inline
@inline function atoi_PairMul(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 14 < srcEnd) {
    const parsed = parse8Digits_PairMul(
      load<u64>(srcStart),
      load<u64>(srcStart, 8),
    );
    if (parsed == U32.MAX_VALUE) break;
    value = value * 100_000_000 + parsed;
    srcStart += 16;
  }
  while (srcStart < srcEnd) {
    const digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }
  return value;
}

// @ts-expect-error: @inline
@inline function atoi_MergeUnmerge(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 14 < srcEnd) {
    const parsed = parse8Digits_MergeUnmerge(
      load<u64>(srcStart),
      load<u64>(srcStart, 8),
    );
    if (parsed == U32.MAX_VALUE) break;
    value = value * 100_000_000 + parsed;
    srcStart += 16;
  }
  while (srcStart < srcEnd) {
    const digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }
  return value;
}

let CUR_PTR: usize = 0;
let CUR_END: usize = 0;

function bench_PairMul(): void {
  blackbox(atoi_PairMul(CUR_PTR, CUR_END));
}
function bench_MergeUnmerge(): void {
  blackbox(atoi_MergeUnmerge(CUR_PTR, CUR_END));
}

function kernel_PairMul(): void {
  const a = load<u64>(CUR_PTR);
  const b = load<u64>(CUR_PTR, 8);
  blackbox(parse8Digits_PairMul(a, b));
  blackbox(parse8Digits_PairMul(a, b));
  blackbox(parse8Digits_PairMul(a, b));
  blackbox(parse8Digits_PairMul(a, b));
}
function kernel_MergeUnmerge(): void {
  const a = load<u64>(CUR_PTR);
  const b = load<u64>(CUR_PTR, 8);
  blackbox(parse8Digits_MergeUnmerge(a, b));
  blackbox(parse8Digits_MergeUnmerge(a, b));
  blackbox(parse8Digits_MergeUnmerge(a, b));
  blackbox(parse8Digits_MergeUnmerge(a, b));
}
function kernel_MergeWrong(): void {
  const a = load<u64>(CUR_PTR);
  const b = load<u64>(CUR_PTR, 8);
  blackbox(parse8Digits_MergeWrong(a, b));
  blackbox(parse8Digits_MergeWrong(a, b));
  blackbox(parse8Digits_MergeWrong(a, b));
  blackbox(parse8Digits_MergeWrong(a, b));
}

CUR_PTR = changetype<usize>(D16);
const KERNEL_OPS: u64 = 50_000_000;
bench("Kernel parse8 PairMul (current)", kernel_PairMul, KERNEL_OPS, 32);
dumpToFile("swar-int-shiftor-h2h-kernel-pairmul", "parse");
bench("Kernel parse8 MergeUnmerge", kernel_MergeUnmerge, KERNEL_OPS, 32);
dumpToFile("swar-int-shiftor-h2h-kernel-merge-unmerge", "parse");
bench(
  "Kernel parse8 MergeWrong (interleaved!)",
  kernel_MergeWrong,
  KERNEL_OPS,
  32,
);
dumpToFile("swar-int-shiftor-h2h-kernel-merge-wrong", "parse");

const widths: i32[] = [8, 16, 32, 64];
for (let i = 0; i < widths.length; i++) {
  const w = unchecked(widths[i]);
  let v: string;
  if (w == 8) v = D8;
  else if (w == 16) v = D16;
  else if (w == 32) v = D32;
  else v = D64;

  CUR_PTR = changetype<usize>(v);
  CUR_END = CUR_PTR + ((<usize>v.length) << 1);
  const ops: u64 = 20_000_000;

  bench(
    "Atoi PairMul (" + w.toString() + "d)",
    bench_PairMul,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-shiftor-h2h-atoi-pairmul-" + w.toString(), "parse");

  bench(
    "Atoi MergeUnmerge (" + w.toString() + "d)",
    bench_MergeUnmerge,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-shiftor-h2h-atoi-merge-" + w.toString(), "parse");
}
