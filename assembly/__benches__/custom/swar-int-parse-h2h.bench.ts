// Head-to-head: SWAR integer parsing variants over UTF-16 sources.
//
// We measure two scenarios:
//   1. Pure inner-kernel throughput: a single function call's amortized cost
//      when called in a tight loop over a fixed digit chunk. Isolates the
//      arithmetic cost of validate+combine.
//   2. End-to-end integer atoi: parse a full N-digit UTF-16 number into a u64
//      using each variant as the bulk-digit stride. Reflects realistic usage
//      including loop overhead.

import { bench, blackbox, dumpToFile } from "../lib/bench";
import { expect } from "../../__tests__/lib";
import {
  parse4Digits_Baseline,
  parse4Digits_PairMul,
  parse4Digits_PairMul_Unsafe,
  parse8Digits_PairMul,
  parse8Digits_PairMul_Unsafe,
  nonDigitMask4,
} from "../../util/swar-int";

// ---------------------------------------------------------------------------
// Test corpora - UTF-16 strings of varying lengths, all valid digits.
// ---------------------------------------------------------------------------

function repeatDigits(n: i32): string {
  let s = "";
  while (s.length < n) s += "1234567890";
  return s.substring(0, n);
}

// 4, 8, 16, 32, 64 digit UTF-16 sources (full integers; the 4-digit one fits
// in u16, 8-digit in u32, 16+ in u64).
const DIGITS_4 = repeatDigits(4);
const DIGITS_8 = repeatDigits(8);
const DIGITS_16 = repeatDigits(16);
const DIGITS_32 = repeatDigits(32);
const DIGITS_64 = repeatDigits(64);

// Hot pointer caches (avoid recomputing in the bench routines).
let PTR_4: usize = changetype<usize>(DIGITS_4);
let PTR_8: usize = changetype<usize>(DIGITS_8);
let PTR_16: usize = changetype<usize>(DIGITS_16);
let PTR_32: usize = changetype<usize>(DIGITS_32);
let PTR_64: usize = changetype<usize>(DIGITS_64);

// ---------------------------------------------------------------------------
// Scenario 1: inner kernel throughput. We unroll 4 calls per iteration to
// amortize the bench harness function-call overhead.
// ---------------------------------------------------------------------------

function kernel_Baseline(): void {
  const block = load<u64>(PTR_4);
  blackbox(parse4Digits_Baseline(block));
  blackbox(parse4Digits_Baseline(block));
  blackbox(parse4Digits_Baseline(block));
  blackbox(parse4Digits_Baseline(block));
}

function kernel_PairMul(): void {
  const block = load<u64>(PTR_4);
  blackbox(parse4Digits_PairMul(block));
  blackbox(parse4Digits_PairMul(block));
  blackbox(parse4Digits_PairMul(block));
  blackbox(parse4Digits_PairMul(block));
}

function kernel_PairMulUnsafe(): void {
  const block = load<u64>(PTR_4);
  blackbox(parse4Digits_PairMul_Unsafe(block));
  blackbox(parse4Digits_PairMul_Unsafe(block));
  blackbox(parse4Digits_PairMul_Unsafe(block));
  blackbox(parse4Digits_PairMul_Unsafe(block));
}

function kernel_8DigitPairMul(): void {
  const lo = load<u64>(PTR_8);
  const hi = load<u64>(PTR_8, 8);
  blackbox(parse8Digits_PairMul(lo, hi));
  blackbox(parse8Digits_PairMul(lo, hi));
  blackbox(parse8Digits_PairMul(lo, hi));
  blackbox(parse8Digits_PairMul(lo, hi));
}

function kernel_8DigitPairMulUnsafe(): void {
  const lo = load<u64>(PTR_8);
  const hi = load<u64>(PTR_8, 8);
  blackbox(parse8Digits_PairMul_Unsafe(lo, hi));
  blackbox(parse8Digits_PairMul_Unsafe(lo, hi));
  blackbox(parse8Digits_PairMul_Unsafe(lo, hi));
  blackbox(parse8Digits_PairMul_Unsafe(lo, hi));
}

// ---------------------------------------------------------------------------
// Scenario 2: end-to-end u64 parsing using each variant's stride.
// ---------------------------------------------------------------------------

// @ts-expect-error: @inline
@inline function atoi_Baseline(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_Baseline(load<u64>(srcStart));
    if (parsed == U32.MAX_VALUE) break;
    value = value * 10000 + parsed;
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

// @ts-expect-error: @inline
@inline function atoi_PairMul(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_PairMul(load<u64>(srcStart));
    if (parsed == U32.MAX_VALUE) break;
    value = value * 10000 + parsed;
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

// @ts-expect-error: @inline
@inline function atoi_8DigitPairMul(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 14 < srcEnd) {
    const lo = load<u64>(srcStart);
    const hi = load<u64>(srcStart, 8);
    const parsed = parse8Digits_PairMul(lo, hi);
    if (parsed == U32.MAX_VALUE) break;
    value = value * 100_000_000 + parsed;
    srcStart += 16;
  }
  // Fall through to 4-digit then scalar so we don't lose precision near tails.
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_PairMul(load<u64>(srcStart));
    if (parsed == U32.MAX_VALUE) break;
    value = value * 10000 + parsed;
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

// Scan-then-parse: locate the digit-run end with one SWAR mask per stride,
// then bulk-parse the known-valid run using the unsafe variants. Eliminates
// the per-stride validation branch from the parse loop.
// @ts-expect-error: @inline
@inline function atoi_ScanThenParse8(srcStart: usize, srcEnd: usize): u64 {
  // Phase 1: find first non-digit position using SWAR mask. Stride 4 digits.
  let scanPtr = srcStart;
  while (scanPtr + 6 < srcEnd) {
    const mask = nonDigitMask4(load<u64>(scanPtr));
    if (mask != 0) {
      // First bad lane is at byte (ctz(mask) & ~7) - but lanes are 16-bit,
      // so the bad code unit's start byte is (ctz(mask) >> 4) << 1.
      scanPtr += ((<usize>ctz(mask)) >> 4) << 1;
      break;
    }
    scanPtr += 8;
  }
  while (scanPtr < srcEnd) {
    const digit = <u32>load<u16>(scanPtr) - 48;
    if (digit > 9) break;
    scanPtr += 2;
  }
  const digitEnd = scanPtr;

  // Phase 2: bulk-parse the known-valid run with unsafe variants.
  let value: u64 = 0;
  let p = srcStart;
  while (p + 14 < digitEnd) {
    const lo = load<u64>(p);
    const hi = load<u64>(p, 8);
    value = value * 100_000_000 + parse8Digits_PairMul_Unsafe(lo, hi);
    p += 16;
  }
  while (p + 6 < digitEnd) {
    value = value * 10_000 + parse4Digits_PairMul_Unsafe(load<u64>(p));
    p += 8;
  }
  while (p < digitEnd) {
    value = value * 10 + (<u32>load<u16>(p) - 48);
    p += 2;
  }
  return value;
}

function full_ScanThenParse8(): void {
  blackbox(atoi_ScanThenParse8(CUR_PTR, CUR_END));
}

// Double-stride: process 16 digits (32 bytes) per outer iter with two
// parallel parse8 calls. Encourages the WASM engine to overlap the two
// independent dependency chains.
// @ts-expect-error: @inline
@inline function atoi_DoubleParse8(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 30 < srcEnd) {
    const lo0 = load<u64>(srcStart);
    const hi0 = load<u64>(srcStart, 8);
    const lo1 = load<u64>(srcStart, 16);
    const hi1 = load<u64>(srcStart, 24);
    const a = parse8Digits_PairMul(lo0, hi0);
    const b = parse8Digits_PairMul(lo1, hi1);
    if ((a | b) == U32.MAX_VALUE) break; // either invalid → fall through
    value = value * 10_000_000_000_000_000 + <u64>a * 100_000_000 + <u64>b;
    srcStart += 32;
  }
  while (srcStart + 14 < srcEnd) {
    const lo = load<u64>(srcStart);
    const hi = load<u64>(srcStart, 8);
    const parsed = parse8Digits_PairMul(lo, hi);
    if (parsed == U32.MAX_VALUE) break;
    value = value * 100_000_000 + parsed;
    srcStart += 16;
  }
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_PairMul(load<u64>(srcStart));
    if (parsed == U32.MAX_VALUE) break;
    value = value * 10000 + parsed;
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

function full_DoubleParse8(): void {
  blackbox(atoi_DoubleParse8(CUR_PTR, CUR_END));
}

// Fused-pair update: the standard form  v = v*B + p1;  v = v*B + p2  has a
// serial mul-chain through v. Reform as  v = v*B² + (p1*B + p2). The two
// halves on the RHS are independent, letting the engine overlap them.
// @ts-expect-error: @inline
@inline function atoi_FusedPairUpdate(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  // 32-byte stride: 16 digits per outer iter, fused.
  while (srcStart + 30 < srcEnd) {
    const lo0 = load<u64>(srcStart);
    const hi0 = load<u64>(srcStart, 8);
    const lo1 = load<u64>(srcStart, 16);
    const hi1 = load<u64>(srcStart, 24);
    const a = parse8Digits_PairMul(lo0, hi0);
    const b = parse8Digits_PairMul(lo1, hi1);
    if ((a | b) >= U32.MAX_VALUE) break;
    // Fused: v*1e16 and (a*1e8 + b) are independent expressions.
    value = value * 10_000_000_000_000_000 + (<u64>a * 100_000_000 + <u64>b);
    srcStart += 32;
  }
  // 16-byte tail (single parse8).
  while (srcStart + 14 < srcEnd) {
    const parsed = parse8Digits_PairMul(
      load<u64>(srcStart),
      load<u64>(srcStart, 8),
    );
    if (parsed == U32.MAX_VALUE) break;
    value = value * 100_000_000 + parsed;
    srcStart += 16;
  }
  // 8-byte tail (single parse4).
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_PairMul(load<u64>(srcStart));
    if (parsed == U32.MAX_VALUE) break;
    value = value * 10_000 + parsed;
    srcStart += 8;
  }
  // Scalar tail.
  while (srcStart < srcEnd) {
    const digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }
  return value;
}

function full_FusedPair(): void {
  blackbox(atoi_FusedPairUpdate(CUR_PTR, CUR_END));
}

// Bulk-validate then unsafe-combine. The 32-byte iter computes all four
// half-masks together so the validation cost is amortized over 16 digits.
// Then it uses the unsafe combine paths (no per-chunk validate branch in the
// arithmetic). This collapses ~4 conditional breaks into 1.
//
// Inlined mask/lane constants here so we keep the file standalone.
const LANE_LO_4: u64 = 0x00ff_00ff_00ff_00ff;
const ZERO_4: u64 = 0x0030_0030_0030_0030;
const RANGE_ADD_4: u64 = 0x0006_0006_0006_0006;
const RANGE_MASK_4: u64 = 0xfff0_fff0_fff0_fff0;
const U32_LO_PAIR: u64 = 0x0000_ffff_0000_ffff;

// @ts-expect-error: @inline
@inline function combine4_unsafe(digits: u64): u32 {
  const pairs = (digits & U32_LO_PAIR) * 10 + ((digits >> 16) & U32_LO_PAIR);
  return <u32>pairs * 100 + <u32>(pairs >> 32);
}

// @ts-expect-error: @inline
@inline function atoi_BulkValidate(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  // 32-byte stride: validate all four chunks at once.
  while (srcStart + 30 < srcEnd) {
    const lo0 = load<u64>(srcStart);
    const hi0 = load<u64>(srcStart, 8);
    const lo1 = load<u64>(srcStart, 16);
    const hi1 = load<u64>(srcStart, 24);

    const d00 = (lo0 & LANE_LO_4) - ZERO_4;
    const d01 = (hi0 & LANE_LO_4) - ZERO_4;
    const d10 = (lo1 & LANE_LO_4) - ZERO_4;
    const d11 = (hi1 & LANE_LO_4) - ZERO_4;

    const bad =
      (d00 |
        (d00 + RANGE_ADD_4) |
        d01 |
        (d01 + RANGE_ADD_4) |
        d10 |
        (d10 + RANGE_ADD_4) |
        d11 |
        (d11 + RANGE_ADD_4)) &
      RANGE_MASK_4;
    if (bad != 0) break;

    const a = combine4_unsafe(d00) * 10000 + combine4_unsafe(d01); // top 8 digits
    const b = combine4_unsafe(d10) * 10000 + combine4_unsafe(d11); // bottom 8 digits
    value = value * 10_000_000_000_000_000 + (<u64>a * 100_000_000 + <u64>b);
    srcStart += 32;
  }
  // 16-byte tail.
  while (srcStart + 14 < srcEnd) {
    const lo = load<u64>(srcStart);
    const hi = load<u64>(srcStart, 8);
    const dlo = (lo & LANE_LO_4) - ZERO_4;
    const dhi = (hi & LANE_LO_4) - ZERO_4;
    const bad =
      (dlo | (dlo + RANGE_ADD_4) | dhi | (dhi + RANGE_ADD_4)) & RANGE_MASK_4;
    if (bad != 0) break;
    const parsed = combine4_unsafe(dlo) * 10000 + combine4_unsafe(dhi);
    value = value * 100_000_000 + parsed;
    srcStart += 16;
  }
  // 8-byte tail.
  while (srcStart + 6 < srcEnd) {
    const block = load<u64>(srcStart);
    const d = (block & LANE_LO_4) - ZERO_4;
    if (((d | (d + RANGE_ADD_4)) & RANGE_MASK_4) != 0) break;
    value = value * 10_000 + combine4_unsafe(d);
    srcStart += 8;
  }
  // Scalar tail.
  while (srcStart < srcEnd) {
    const digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }
  return value;
}

function full_BulkValidate(): void {
  blackbox(atoi_BulkValidate(CUR_PTR, CUR_END));
}

// 64-byte stride bulk-validate: 32 digits per iter. Pushes the loop-overhead
// floor further for very long inputs.
// @ts-expect-error: @inline
@inline function atoi_BulkValidate64(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 62 < srcEnd) {
    const l0 = load<u64>(srcStart);
    const l1 = load<u64>(srcStart, 8);
    const l2 = load<u64>(srcStart, 16);
    const l3 = load<u64>(srcStart, 24);
    const l4 = load<u64>(srcStart, 32);
    const l5 = load<u64>(srcStart, 40);
    const l6 = load<u64>(srcStart, 48);
    const l7 = load<u64>(srcStart, 56);

    const d0 = (l0 & LANE_LO_4) - ZERO_4;
    const d1 = (l1 & LANE_LO_4) - ZERO_4;
    const d2 = (l2 & LANE_LO_4) - ZERO_4;
    const d3 = (l3 & LANE_LO_4) - ZERO_4;
    const d4 = (l4 & LANE_LO_4) - ZERO_4;
    const d5 = (l5 & LANE_LO_4) - ZERO_4;
    const d6 = (l6 & LANE_LO_4) - ZERO_4;
    const d7 = (l7 & LANE_LO_4) - ZERO_4;

    const bad =
      (d0 |
        (d0 + RANGE_ADD_4) |
        d1 |
        (d1 + RANGE_ADD_4) |
        d2 |
        (d2 + RANGE_ADD_4) |
        d3 |
        (d3 + RANGE_ADD_4) |
        d4 |
        (d4 + RANGE_ADD_4) |
        d5 |
        (d5 + RANGE_ADD_4) |
        d6 |
        (d6 + RANGE_ADD_4) |
        d7 |
        (d7 + RANGE_ADD_4)) &
      RANGE_MASK_4;
    if (bad != 0) break;

    // Combine 4×8-digit chunks into a single u64 contribution. Each chunk's
    // 4-digit fold is independent, encouraging ILP across the 8 lanes.
    const c0 = combine4_unsafe(d0) * 10000 + combine4_unsafe(d1); // digits 0..7
    const c1 = combine4_unsafe(d2) * 10000 + combine4_unsafe(d3); // digits 8..15
    const c2 = combine4_unsafe(d4) * 10000 + combine4_unsafe(d5); // digits 16..23
    const c3 = combine4_unsafe(d6) * 10000 + combine4_unsafe(d7); // digits 24..31

    // 32 digits per iter. Weights within iter are 10^24, 10^16, 10^8, 10^0.
    // 10^24 and 10^32 overflow u64; the multiplication wraps and that wrap
    // is bit-exact equivalent to sequential *1e8 chained 4× under mod 2^64.
    const K8: u64 = 100_000_000;
    const K16: u64 = K8 * K8;
    const K24: u64 = K16 * K8;
    const K32: u64 = K16 * K16;
    value =
      value * K32 + <u64>c0 * K24 + <u64>c1 * K16 + <u64>c2 * K8 + <u64>c3;
    srcStart += 64;
  }
  // 32-byte tail.
  while (srcStart + 30 < srcEnd) {
    const lo0 = load<u64>(srcStart);
    const hi0 = load<u64>(srcStart, 8);
    const lo1 = load<u64>(srcStart, 16);
    const hi1 = load<u64>(srcStart, 24);
    const d00 = (lo0 & LANE_LO_4) - ZERO_4;
    const d01 = (hi0 & LANE_LO_4) - ZERO_4;
    const d10 = (lo1 & LANE_LO_4) - ZERO_4;
    const d11 = (hi1 & LANE_LO_4) - ZERO_4;
    const bad =
      (d00 |
        (d00 + RANGE_ADD_4) |
        d01 |
        (d01 + RANGE_ADD_4) |
        d10 |
        (d10 + RANGE_ADD_4) |
        d11 |
        (d11 + RANGE_ADD_4)) &
      RANGE_MASK_4;
    if (bad != 0) break;
    const a = combine4_unsafe(d00) * 10000 + combine4_unsafe(d01);
    const b = combine4_unsafe(d10) * 10000 + combine4_unsafe(d11);
    value = value * 10_000_000_000_000_000 + (<u64>a * 100_000_000 + <u64>b);
    srcStart += 32;
  }
  while (srcStart + 14 < srcEnd) {
    const lo = load<u64>(srcStart);
    const hi = load<u64>(srcStart, 8);
    const dlo = (lo & LANE_LO_4) - ZERO_4;
    const dhi = (hi & LANE_LO_4) - ZERO_4;
    const bad =
      (dlo | (dlo + RANGE_ADD_4) | dhi | (dhi + RANGE_ADD_4)) & RANGE_MASK_4;
    if (bad != 0) break;
    value =
      value * 100_000_000 +
      (combine4_unsafe(dlo) * 10000 + combine4_unsafe(dhi));
    srcStart += 16;
  }
  while (srcStart + 6 < srcEnd) {
    const block = load<u64>(srcStart);
    const d = (block & LANE_LO_4) - ZERO_4;
    if (((d | (d + RANGE_ADD_4)) & RANGE_MASK_4) != 0) break;
    value = value * 10_000 + combine4_unsafe(d);
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

function full_BulkValidate64(): void {
  blackbox(atoi_BulkValidate64(CUR_PTR, CUR_END));
}

// Cached scratch - set per scenario before calling.
let CUR_PTR: usize = 0;
let CUR_END: usize = 0;

function full_Baseline(): void {
  blackbox(atoi_Baseline(CUR_PTR, CUR_END));
}
function full_PairMul(): void {
  blackbox(atoi_PairMul(CUR_PTR, CUR_END));
}
function full_8DigitPairMul(): void {
  blackbox(atoi_8DigitPairMul(CUR_PTR, CUR_END));
}

// ---------------------------------------------------------------------------
// Correctness gate - make sure every variant computes the same digit value
// for a representative sweep before we trust the bench numbers.
// ---------------------------------------------------------------------------

function verifyKernels(): void {
  // Spot check across all 4-digit chunks
  for (let n: u32 = 0; n < 10_000; n += 173) {
    let s = n.toString();
    while (s.length < 4) s = "0" + s;
    let block: u64 = 0;
    for (let i = 0; i < 4; i++)
      block |= (<u64>s.charCodeAt(i)) << (<u64>i * 16);
    expect(parse4Digits_Baseline(block)).toBe(n);
    expect(parse4Digits_PairMul(block)).toBe(n);
    expect(parse4Digits_PairMul_Unsafe(block)).toBe(n);
  }

  // Sweep a handful of 8-digit chunks
  const probes: u32[] = [12345678, 99999999, 10101010, 80000001, 1];
  for (let i = 0; i < probes.length; i++) {
    const n = unchecked(probes[i]);
    let s = n.toString();
    while (s.length < 8) s = "0" + s;
    let lo: u64 = 0,
      hi: u64 = 0;
    for (let j = 0; j < 4; j++) lo |= (<u64>s.charCodeAt(j)) << (<u64>j * 16);
    for (let j = 0; j < 4; j++)
      hi |= (<u64>s.charCodeAt(4 + j)) << (<u64>j * 16);
    expect(parse8Digits_PairMul(lo, hi)).toBe(n);
    expect(parse8Digits_PairMul_Unsafe(lo, hi)).toBe(n);
  }
}

function verifyAtoi(): void {
  const inputs: string[] = [DIGITS_4, DIGITS_8, DIGITS_16, DIGITS_32];
  for (let i = 0; i < inputs.length; i++) {
    const v = unchecked(inputs[i]);
    const ptr = changetype<usize>(v);
    const end = ptr + ((<usize>v.length) << 1);
    const a = atoi_Baseline(ptr, end);
    const b = atoi_PairMul(ptr, end);
    const c = atoi_8DigitPairMul(ptr, end);
    const d = atoi_ScanThenParse8(ptr, end);
    const e = atoi_DoubleParse8(ptr, end);
    const f = atoi_FusedPairUpdate(ptr, end);
    const g = atoi_BulkValidate(ptr, end);
    const h = atoi_BulkValidate64(ptr, end);
    expect<u64>(b).toBe(a);
    expect<u64>(c).toBe(a);
    expect<u64>(d).toBe(a);
    expect<u64>(e).toBe(a);
    expect<u64>(f).toBe(a);
    expect<u64>(g).toBe(a);
    expect<u64>(h).toBe(a);
  }
}

verifyKernels();
verifyAtoi();

// ---------------------------------------------------------------------------
// Run benches.
// ---------------------------------------------------------------------------

const KERNEL_OPS: u64 = 50_000_000;

bench("Kernel parse4 Baseline", kernel_Baseline, KERNEL_OPS, 16);
dumpToFile("swar-int-parse-h2h-kernel-baseline", "parse");

bench("Kernel parse4 PairMul", kernel_PairMul, KERNEL_OPS, 16);
dumpToFile("swar-int-parse-h2h-kernel-pairmul", "parse");

bench("Kernel parse4 PairMul Unsafe", kernel_PairMulUnsafe, KERNEL_OPS, 16);
dumpToFile("swar-int-parse-h2h-kernel-pairmul-unsafe", "parse");

bench("Kernel parse8 PairMul", kernel_8DigitPairMul, KERNEL_OPS, 32);
dumpToFile("swar-int-parse-h2h-kernel-parse8", "parse");

bench(
  "Kernel parse8 PairMul Unsafe",
  kernel_8DigitPairMulUnsafe,
  KERNEL_OPS,
  32,
);
dumpToFile("swar-int-parse-h2h-kernel-parse8-unsafe", "parse");

// Scenario 2: atoi over different widths.
const widths: i32[] = [4, 8, 16, 32, 64];
for (let i = 0; i < widths.length; i++) {
  const w = unchecked(widths[i]);
  let v: string;
  if (w == 4) v = DIGITS_4;
  else if (w == 8) v = DIGITS_8;
  else if (w == 16) v = DIGITS_16;
  else if (w == 32) v = DIGITS_32;
  else v = DIGITS_64;

  CUR_PTR = changetype<usize>(v);
  CUR_END = CUR_PTR + ((<usize>v.length) << 1);
  const ops: u64 = 20_000_000;

  bench(
    "Atoi Baseline (" + w.toString() + "d)",
    full_Baseline,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-parse-h2h-atoi-baseline-" + w.toString(), "parse");

  bench(
    "Atoi PairMul (" + w.toString() + "d)",
    full_PairMul,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-parse-h2h-atoi-pairmul-" + w.toString(), "parse");

  bench(
    "Atoi Parse8 (" + w.toString() + "d)",
    full_8DigitPairMul,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-parse-h2h-atoi-parse8-" + w.toString(), "parse");

  bench(
    "Atoi ScanThenParse8 (" + w.toString() + "d)",
    full_ScanThenParse8,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-parse-h2h-atoi-scan-" + w.toString(), "parse");

  bench(
    "Atoi DoubleParse8 (" + w.toString() + "d)",
    full_DoubleParse8,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-parse-h2h-atoi-double-" + w.toString(), "parse");

  bench(
    "Atoi FusedPair (" + w.toString() + "d)",
    full_FusedPair,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-parse-h2h-atoi-fused-" + w.toString(), "parse");

  bench(
    "Atoi BulkValidate (" + w.toString() + "d)",
    full_BulkValidate,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-parse-h2h-atoi-bulk-" + w.toString(), "parse");

  bench(
    "Atoi BulkValidate64 (" + w.toString() + "d)",
    full_BulkValidate64,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-parse-h2h-atoi-bulk64-" + w.toString(), "parse");
}
