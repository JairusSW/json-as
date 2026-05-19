// Head-to-head: current SWAR parse4 vs op-reduced "magic-mul" form.
//
// Two reductions:
//   1. Skip the initial `& LANE_LO_4` mask. For valid UTF-16 ASCII the high
//      byte is already 0, so the AND is redundant. The validation step runs
//      before the multiply and rejects any input where dropping the AND
//      would cause carries to corrupt the multiply.
//   2. Magic-multiplier final combine: `(pairs * (1 + (100 << 32))) >> 32`.
//      With `pairs = (cd << 32) | ab` (each pair ≤ 99), the u64 multiply
//      places `ab*100 + cd` in the high 32 bits via the cross-term.

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
// MAGIC = 1 + (100 << 32). pairs * MAGIC places ab*100 + cd in the high 32.
const FINAL_MAGIC: u64 = 0x0000_0064_0000_0001;

// @ts-expect-error: @inline
@inline function parse4Digits_OpReduced(block: u64): u32 {
  // Skip initial `& LANE_LO_4` — validation runs before any multiply.
  const digits = block - ZERO_4;
  if (((digits | (digits + RANGE_ADD_4)) & RANGE_MASK_4) != 0) {
    return U32.MAX_VALUE;
  }
  const pairs = (digits * 10 + (digits >> 16)) & U32_LO_PAIR;
  return <u32>((pairs * FINAL_MAGIC) >> 32);
}

// @ts-expect-error: @inline
@inline function parse4Digits_OpReduced_Unsafe(block: u64): u32 {
  // For unsafe path the high bytes must be 0 (caller guarantees ASCII).
  const digits = block - ZERO_4;
  const pairs = (digits * 10 + (digits >> 16)) & U32_LO_PAIR;
  return <u32>((pairs * FINAL_MAGIC) >> 32);
}

// Isolated optimizations to identify which one carries which gain.
// @ts-expect-error: @inline
@inline function parse4Digits_SkipMask(block: u64): u32 {
  // Only optimization: skip initial `& LANE_LO_4`.
  const digits = block - ZERO_4;
  if (((digits | (digits + RANGE_ADD_4)) & RANGE_MASK_4) != 0)
    return U32.MAX_VALUE;
  const pairs = (digits * 10 + (digits >> 16)) & U32_LO_PAIR;
  return <u32>pairs * 100 + <u32>(pairs >> 32);
}

// @ts-expect-error: @inline
@inline function parse4Digits_MagicMul(block: u64): u32 {
  // Only optimization: magic-mul final combine.
  const digits = (block & LANE_LO_4) - ZERO_4;
  if (((digits | (digits + RANGE_ADD_4)) & RANGE_MASK_4) != 0)
    return U32.MAX_VALUE;
  const pairs = (digits * 10 + (digits >> 16)) & U32_LO_PAIR;
  return <u32>((pairs * FINAL_MAGIC) >> 32);
}

// ---------------------------------------------------------------------------
// 16-digit variant with the same reductions applied to each 4-digit fold.
// ---------------------------------------------------------------------------
// @ts-expect-error: @inline
@inline function parse16Digits_OpReduced(srcStart: usize): u64 {
  const b0 = load<u64>(srcStart);
  const b1 = load<u64>(srcStart, 8);
  const b2 = load<u64>(srcStart, 16);
  const b3 = load<u64>(srcStart, 24);

  const d0 = b0 - ZERO_4;
  const d1 = b1 - ZERO_4;
  const d2 = b2 - ZERO_4;
  const d3 = b3 - ZERO_4;

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

  const p0 = (d0 * 10 + (d0 >> 16)) & U32_LO_PAIR;
  const p1 = (d1 * 10 + (d1 >> 16)) & U32_LO_PAIR;
  const p2 = (d2 * 10 + (d2 >> 16)) & U32_LO_PAIR;
  const p3 = (d3 * 10 + (d3 >> 16)) & U32_LO_PAIR;

  const v0 = <u32>((p0 * FINAL_MAGIC) >> 32);
  const v1 = <u32>((p1 * FINAL_MAGIC) >> 32);
  const v2 = <u32>((p2 * FINAL_MAGIC) >> 32);
  const v3 = <u32>((p3 * FINAL_MAGIC) >> 32);

  const pair01 = <u64>v0 * 10_000 + <u64>v1;
  const pair23 = <u64>v2 * 10_000 + <u64>v3;
  return pair01 * 100_000_000 + pair23;
}

// ---------------------------------------------------------------------------
// Test corpora & verify.
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

function pack4(s: string): u64 {
  let block: u64 = 0;
  for (let i = 0; i < 4; i++) block |= (<u64>s.charCodeAt(i)) << (<u64>i * 16);
  return block;
}

function verify(): void {
  // Op-reduced parse4 must agree with current parse4_PairMul on valid input.
  for (let n: u32 = 0; n < 10_000; n += 173) {
    let s = n.toString();
    while (s.length < 4) s = "0" + s;
    const block = pack4(s);
    expect<u32>(parse4Digits_OpReduced(block)).toBe(
      parse4Digits_PairMul(block),
    );
    expect<u32>(parse4Digits_OpReduced_Unsafe(block)).toBe(
      parse4Digits_PairMul_Unsafe(block),
    );
  }

  // Rejection cases.
  const invalid: string[] = ["/123", ":123", "1a23", "12 3"];
  for (let i = 0; i < invalid.length; i++) {
    const block = pack4(unchecked(invalid[i]));
    expect<u32>(parse4Digits_OpReduced(block)).toBe(U32.MAX_VALUE);
  }
  // Non-ASCII (high byte set) — without the initial mask, validation must still catch.
  expect<u32>(parse4Digits_OpReduced(0x0033_0100_0032_0031)).toBe(
    U32.MAX_VALUE,
  );

  // 16-digit kernel correctness.
  const inputs: string[] = [D16, D32];
  for (let i = 0; i < inputs.length; i++) {
    const v = unchecked(inputs[i]);
    const p = changetype<usize>(v);
    // Compare against the production parse16 (sequential 4× parse4) at the first 16 chars only.
    let expected: u64 = 0;
    for (let j: u32 = 0; j < 16; j++) {
      expected =
        expected * 10 + <u32>(<u32>load<u16>(p + ((<usize>j) << 1)) - 48);
    }
    expect<u64>(parse16Digits_OpReduced(p)).toBe(expected);
  }
}

verify();

// ---------------------------------------------------------------------------
// Atoi variants for benchmark.
// ---------------------------------------------------------------------------

// @ts-expect-error: @inline
@inline function atoi_Current(srcStart: usize, srcEnd: usize): u64 {
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
@inline function atoi_OpReduced(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_OpReduced(load<u64>(srcStart));
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
@inline function atoi_SkipMask(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_SkipMask(load<u64>(srcStart));
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
@inline function atoi_MagicMul(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_MagicMul(load<u64>(srcStart));
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
@inline function atoi_OpReduced16(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 30 < srcEnd) {
    const parsed = parse16Digits_OpReduced(srcStart);
    if (parsed == U64.MAX_VALUE) break;
    value = value * 10_000_000_000_000_000 + parsed;
    srcStart += 32;
  }
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_OpReduced(load<u64>(srcStart));
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

let CUR_PTR: usize = 0;
let CUR_END: usize = 0;
function bench_Current(): void {
  blackbox(atoi_Current(CUR_PTR, CUR_END));
}
function bench_OpReduced(): void {
  blackbox(atoi_OpReduced(CUR_PTR, CUR_END));
}
function bench_OpReduced16(): void {
  blackbox(atoi_OpReduced16(CUR_PTR, CUR_END));
}
function bench_SkipMask(): void {
  blackbox(atoi_SkipMask(CUR_PTR, CUR_END));
}
function bench_MagicMul(): void {
  blackbox(atoi_MagicMul(CUR_PTR, CUR_END));
}

function kernel_Current(): void {
  const block = load<u64>(CUR_PTR);
  blackbox(parse4Digits_PairMul(block));
  blackbox(parse4Digits_PairMul(block));
  blackbox(parse4Digits_PairMul(block));
  blackbox(parse4Digits_PairMul(block));
}
function kernel_OpReduced(): void {
  const block = load<u64>(CUR_PTR);
  blackbox(parse4Digits_OpReduced(block));
  blackbox(parse4Digits_OpReduced(block));
  blackbox(parse4Digits_OpReduced(block));
  blackbox(parse4Digits_OpReduced(block));
}

CUR_PTR = changetype<usize>(D8);
const KERNEL_OPS: u64 = 50_000_000;
bench("Kernel parse4 Current", kernel_Current, KERNEL_OPS, 16);
dumpToFile("swar-int-magic-h2h-kernel-current", "parse");
bench("Kernel parse4 OpReduced", kernel_OpReduced, KERNEL_OPS, 16);
dumpToFile("swar-int-magic-h2h-kernel-opreduced", "parse");

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
    "Atoi Current (" + w.toString() + "d)",
    bench_Current,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-magic-h2h-atoi-current-" + w.toString(), "parse");

  bench(
    "Atoi OpReduced (" + w.toString() + "d)",
    bench_OpReduced,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-magic-h2h-atoi-opreduced-" + w.toString(), "parse");

  bench(
    "Atoi OpReduced16 (" + w.toString() + "d)",
    bench_OpReduced16,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-magic-h2h-atoi-opreduced16-" + w.toString(), "parse");

  bench(
    "Atoi SkipMask only (" + w.toString() + "d)",
    bench_SkipMask,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-magic-h2h-atoi-skipmask-" + w.toString(), "parse");

  bench(
    "Atoi MagicMul only (" + w.toString() + "d)",
    bench_MagicMul,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-magic-h2h-atoi-magicmul-" + w.toString(), "parse");
}
