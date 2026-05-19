// SWAR head-to-head: my PairMul kernel vs a Lemire-style mul-then-mask.
//
// Insight from Lemire's 8-byte ASCII algorithm: apply `val * 10 + (val >> 8)`
// to the WHOLE word and mask AFTER, not before. For valid digit input each
// lane stays small enough that no inter-lane carry happens, so the masked
// result is identical — but we save one AND op.
//
// Plus a 16-digit (4×u64) SWAR kernel mirroring the SIMD NEW-16 wider-stride
// approach.

import { bench, blackbox, dumpToFile } from "../lib/bench";
import { expect } from "../../__tests__/lib";
import {
  parse4Digits_PairMul,
  parse4Digits_PairMul_Unsafe,
} from "../../util/swar-int";

const LANE_LO_4: u64 = 0x00ff_00ff_00ff_00ff;
const ZERO_4: u64 = 0x0030_0030_0030_0030;
const RANGE_ADD_4: u64 = 0x0006_0006_0006_0006;
const RANGE_MASK_4: u64 = 0xfff0_fff0_fff0_fff0;
const U32_LO_PAIR: u64 = 0x0000_ffff_0000_ffff;

// ---------------------------------------------------------------------------
// Lemire-style fold: mul-then-mask. Saves one AND vs my current PairMul.
// For valid digit lanes (0..9), `digits * 10` doesn't carry across lane
// boundaries (each lane ≤ 90 < 2^7), and `digits >> 16` is a straight shift.
// So `(digits * 10 + (digits >> 16))` has lane 0 = 10a+b, lane 1 = 10b+c
// (garbage), lane 2 = 10c+d, lane 3 = 10d (garbage). Mask kills the garbage.
// ---------------------------------------------------------------------------
// @ts-expect-error: @inline
@inline function parse4Digits_Lemire(block: u64): u32 {
  const digits = (block & LANE_LO_4) - ZERO_4;
  if (((digits | (digits + RANGE_ADD_4)) & RANGE_MASK_4) != 0)
    return U32.MAX_VALUE;
  const pairs = (digits * 10 + (digits >> 16)) & U32_LO_PAIR;
  return <u32>pairs * 100 + <u32>(pairs >> 32);
}

// Unsafe version: skip the validate branch.
// @ts-expect-error: @inline
@inline function parse4Digits_Lemire_Unsafe(block: u64): u32 {
  const digits = (block & LANE_LO_4) - ZERO_4;
  const pairs = (digits * 10 + (digits >> 16)) & U32_LO_PAIR;
  return <u32>pairs * 100 + <u32>(pairs >> 32);
}

// ---------------------------------------------------------------------------
// 16-digit SWAR kernel: 4 u64 loads (32 bytes), bulk-validate, parallel
// 4-digit folds, tree combine. Mirrors the SIMD NEW-16 shape.
// ---------------------------------------------------------------------------
// @ts-expect-error: @inline
@inline function parse16Digits_Lemire_SWAR(srcStart: usize): u64 {
  const b0 = load<u64>(srcStart);
  const b1 = load<u64>(srcStart, 8);
  const b2 = load<u64>(srcStart, 16);
  const b3 = load<u64>(srcStart, 24);

  const d0 = (b0 & LANE_LO_4) - ZERO_4;
  const d1 = (b1 & LANE_LO_4) - ZERO_4;
  const d2 = (b2 & LANE_LO_4) - ZERO_4;
  const d3 = (b3 & LANE_LO_4) - ZERO_4;

  const bad =
    (d0 |
      (d0 + RANGE_ADD_4) |
      d1 |
      (d1 + RANGE_ADD_4) |
      d2 |
      (d2 + RANGE_ADD_4) |
      d3 |
      (d3 + RANGE_ADD_4)) &
    RANGE_MASK_4;
  if (bad != 0) return U64.MAX_VALUE;

  // Parallel folds — four independent chains.
  const p0 = (d0 * 10 + (d0 >> 16)) & U32_LO_PAIR;
  const p1 = (d1 * 10 + (d1 >> 16)) & U32_LO_PAIR;
  const p2 = (d2 * 10 + (d2 >> 16)) & U32_LO_PAIR;
  const p3 = (d3 * 10 + (d3 >> 16)) & U32_LO_PAIR;

  // Inner combine to 4-digit values (4 independent chains).
  const v0 = <u32>p0 * 100 + <u32>(p0 >> 32);
  const v1 = <u32>p1 * 100 + <u32>(p1 >> 32);
  const v2 = <u32>p2 * 100 + <u32>(p2 >> 32);
  const v3 = <u32>p3 * 100 + <u32>(p3 >> 32);

  // Tree combine: parallel pairs first, then final.
  const pair01 = <u64>v0 * 10_000 + <u64>v1; // digits 0..7
  const pair23 = <u64>v2 * 10_000 + <u64>v3; // digits 8..15
  return pair01 * 100_000_000 + pair23; // digits 0..15
}

// ---------------------------------------------------------------------------
// Atoi variants for each parser.
// ---------------------------------------------------------------------------

// @ts-expect-error: @inline
@inline function atoi_PairMul(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
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

// @ts-expect-error: @inline
@inline function atoi_Lemire4(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_Lemire(load<u64>(srcStart));
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

// @ts-expect-error: @inline
@inline function atoi_Lemire16(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  // Wide stride: 16 digits per iter.
  while (srcStart + 30 < srcEnd) {
    const parsed = parse16Digits_Lemire_SWAR(srcStart);
    if (parsed == U64.MAX_VALUE) break;
    value = value * 10_000_000_000_000_000 + parsed;
    srcStart += 32;
  }
  // 4-digit tail.
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_Lemire(load<u64>(srcStart));
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

// ---------------------------------------------------------------------------
// Test corpora & verification.
// ---------------------------------------------------------------------------

function buildDigits(n: i32): string {
  let s = "";
  while (s.length < n) s += "1234567890";
  return s.substring(0, n);
}

const D4 = buildDigits(4);
const D8 = buildDigits(8);
const D16 = buildDigits(16);
const D32 = buildDigits(32);
const D64 = buildDigits(64);

function verify(): void {
  // Kernel equivalence: parse4Digits_Lemire must agree with parse4Digits_PairMul.
  for (let n: u32 = 0; n < 10000; n += 173) {
    let s = n.toString();
    while (s.length < 4) s = "0" + s;
    let block: u64 = 0;
    for (let i = 0; i < 4; i++)
      block |= (<u64>s.charCodeAt(i)) << (<u64>i * 16);
    expect<u32>(parse4Digits_Lemire(block)).toBe(parse4Digits_PairMul(block));
    expect<u32>(parse4Digits_Lemire_Unsafe(block)).toBe(
      parse4Digits_PairMul_Unsafe(block),
    );
  }

  // 16-digit kernel
  const p16 = changetype<usize>(D16);
  const expected = atoi_PairMul(p16, p16 + 32);
  expect<u64>(parse16Digits_Lemire_SWAR(p16)).toBe(expected);

  // Atoi cross-check.
  const inputs: string[] = [D4, D8, D16, D32, D64];
  for (let i = 0; i < inputs.length; i++) {
    const v = unchecked(inputs[i]);
    const p = changetype<usize>(v);
    const e = p + ((<usize>v.length) << 1);
    const a = atoi_PairMul(p, e);
    expect<u64>(atoi_Lemire4(p, e)).toBe(a);
    expect<u64>(atoi_Lemire16(p, e)).toBe(a);
  }
}

verify();

// ---------------------------------------------------------------------------
// Bench routines.
// ---------------------------------------------------------------------------

let CUR_PTR: usize = 0;
let CUR_END: usize = 0;
function bench_PairMul(): void {
  blackbox(atoi_PairMul(CUR_PTR, CUR_END));
}
function bench_Lemire4(): void {
  blackbox(atoi_Lemire4(CUR_PTR, CUR_END));
}
function bench_Lemire16(): void {
  blackbox(atoi_Lemire16(CUR_PTR, CUR_END));
}

function kernel_PairMul(): void {
  const block = load<u64>(CUR_PTR);
  blackbox(parse4Digits_PairMul(block));
  blackbox(parse4Digits_PairMul(block));
  blackbox(parse4Digits_PairMul(block));
  blackbox(parse4Digits_PairMul(block));
}
function kernel_Lemire4(): void {
  const block = load<u64>(CUR_PTR);
  blackbox(parse4Digits_Lemire(block));
  blackbox(parse4Digits_Lemire(block));
  blackbox(parse4Digits_Lemire(block));
  blackbox(parse4Digits_Lemire(block));
}
function kernel_Lemire16(): void {
  blackbox(parse16Digits_Lemire_SWAR(CUR_PTR));
  blackbox(parse16Digits_Lemire_SWAR(CUR_PTR));
  blackbox(parse16Digits_Lemire_SWAR(CUR_PTR));
  blackbox(parse16Digits_Lemire_SWAR(CUR_PTR));
}

CUR_PTR = changetype<usize>(D8);
const KERNEL_OPS: u64 = 50_000_000;
bench("Kernel parse4 PairMul", kernel_PairMul, KERNEL_OPS, 16);
dumpToFile("swar-int-lemire-h2h-kernel-pairmul", "parse");
bench("Kernel parse4 Lemire", kernel_Lemire4, KERNEL_OPS, 16);
dumpToFile("swar-int-lemire-h2h-kernel-lemire4", "parse");

CUR_PTR = changetype<usize>(D16);
bench("Kernel parse16 Lemire", kernel_Lemire16, KERNEL_OPS, 128);
dumpToFile("swar-int-lemire-h2h-kernel-lemire16", "parse");

const widths: i32[] = [4, 8, 16, 32, 64];
for (let i = 0; i < widths.length; i++) {
  const w = unchecked(widths[i]);
  let v: string;
  if (w == 4) v = D4;
  else if (w == 8) v = D8;
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
  dumpToFile("swar-int-lemire-h2h-atoi-pairmul-" + w.toString(), "parse");

  bench(
    "Atoi Lemire4 (" + w.toString() + "d)",
    bench_Lemire4,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-lemire-h2h-atoi-lemire4-" + w.toString(), "parse");

  bench(
    "Atoi Lemire16 (" + w.toString() + "d)",
    bench_Lemire16,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-lemire-h2h-atoi-lemire16-" + w.toString(), "parse");
}
