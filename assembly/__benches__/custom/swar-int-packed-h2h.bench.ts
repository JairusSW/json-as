// Head-to-head: pack-then-Lemire vs current PairMul for 8-digit SWAR.
//
// Idea (user-proposed):
//   1. Validate high bytes are 0 (= UTF-16 lanes are ASCII).
//   2. Pack two u64s (8 UTF-16 chars / 16 bytes) into one u64 (8 ASCII bytes).
//   3. Run Lemire's classic 8-byte ASCII algorithm — which folds 8 digits in
//      3 multiplications total (vs my current 5 for parse8 PairMul).
//
// The trade-off: Lemire's combine is leaner (3 muls vs 5), but pure-SWAR
// packing of UTF-16 → ASCII costs ~20 ops. We bench to find out whether
// "fewer muls" beats "extra shift-and-OR".

import { bench, blackbox, dumpToFile } from "../lib/bench";
import { expect } from "../../__tests__/lib";
import { parse8Digits_PairMul } from "../../util/swar-int";

const LANE_HI_4: u64 = 0xff00_ff00_ff00_ff00;
const ZERO_8: u64 = 0x3030_3030_3030_3030;
const DIGIT_TEST_ADD: u64 = 0x7676_7676_7676_7676;
const HIGH_BIT_8: u64 = 0x8080_8080_8080_8080;
const LEMIRE_PAIR_MASK: u64 = 0x00ff_00ff_00ff_00ff;
const LEMIRE_INNER_MASK: u64 = 0x0000_00ff_0000_00ff;
// Lemire 2-mul cross-term magic for 4-pair combine.
// (val & inner_mask) * MAGIC_EVEN, with even pairs at positions (0, 4) bytes:
//   low 32 = pair0 * 100
//   high 32 = pair0 * 10^6 + pair2 * 100
const LEMIRE_MAGIC_EVEN: u64 = 100 + (1_000_000 << 32);
// (val >> 16 & inner_mask) * MAGIC_ODD, odd pairs at positions (0, 4) bytes:
//   low 32 = pair1
//   high 32 = pair1 * 10^4 + pair3
const LEMIRE_MAGIC_ODD: u64 = 1 + (10_000 << 32);

// ---------------------------------------------------------------------------
// Variant A — pack-then-Lemire (full validation).
// ---------------------------------------------------------------------------
// @ts-expect-error: @inline
@inline function parse8Digits_PackLemire(lo: u64, hi: u64): u32 {
  // Step 1: validate high bytes are 0 (= UTF-16 ASCII range).
  if (((lo | hi) & LANE_HI_4) != 0) return U32.MAX_VALUE;

  // Step 2: pack 2× u64 UTF-16 → 1× u64 ASCII (8 bytes).
  // lo: bytes (a, 0, b, 0, c, 0, d, 0). We want (a, b, c, d) in low 4 bytes.
  // Each shift-and-mask compacts one byte into its target position.
  const pLo =
    (lo & 0xff) |
    ((lo >> 8) & 0xff00) |
    ((lo >> 16) & 0xff_0000) |
    ((lo >> 24) & 0xff00_0000);
  const pHi =
    (hi & 0xff) |
    ((hi >> 8) & 0xff00) |
    ((hi >> 16) & 0xff_0000) |
    ((hi >> 24) & 0xff00_0000);
  const packed = pLo | (pHi << 32);

  // Step 3: subtract '0' from each byte.
  const val = packed - ZERO_8;

  // Step 4: validate each byte is in [0, 9]. Mula's trick:
  //   ((val + 0x76) | val) & 0x80 — if any byte ≥ 10 or underflowed, bit 7
  //   is set somewhere in the result.
  if (((val + DIGIT_TEST_ADD) | val) & HIGH_BIT_8) return U32.MAX_VALUE;

  // Step 5: Lemire's classic 8-byte ASCII combine — 3 muls, 2 shifts.
  // (val * 10 + val >> 8) & PAIR_MASK puts pair values at bytes (0, 2, 4, 6).
  const v1 = (val * 10 + (val >> 8)) & LEMIRE_PAIR_MASK;
  // Cross-term magic: ab*100 + (cd*100) lands in high 32; ef*10^6 + ab*100
  // lands in high 32 via the cross multiply.
  const result =
    ((v1 & LEMIRE_INNER_MASK) * LEMIRE_MAGIC_EVEN +
      ((v1 >> 16) & LEMIRE_INNER_MASK) * LEMIRE_MAGIC_ODD) >>
    32;
  return <u32>result;
}

// ---------------------------------------------------------------------------
// Variant B — unsafe pack-then-Lemire (skip validation). Reference floor.
// ---------------------------------------------------------------------------
// @ts-expect-error: @inline
@inline function parse8Digits_PackLemire_Unsafe(lo: u64, hi: u64): u32 {
  const pLo =
    (lo & 0xff) |
    ((lo >> 8) & 0xff00) |
    ((lo >> 16) & 0xff_0000) |
    ((lo >> 24) & 0xff00_0000);
  const pHi =
    (hi & 0xff) |
    ((hi >> 8) & 0xff00) |
    ((hi >> 16) & 0xff_0000) |
    ((hi >> 24) & 0xff00_0000);
  const packed = pLo | (pHi << 32);
  const val = packed - ZERO_8;
  const v1 = (val * 10 + (val >> 8)) & LEMIRE_PAIR_MASK;
  const result =
    ((v1 & LEMIRE_INNER_MASK) * LEMIRE_MAGIC_EVEN +
      ((v1 >> 16) & LEMIRE_INNER_MASK) * LEMIRE_MAGIC_ODD) >>
    32;
  return <u32>result;
}

// ---------------------------------------------------------------------------
// Atoi loops using each parser.
// ---------------------------------------------------------------------------

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
@inline function atoi_PackLemire(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 14 < srcEnd) {
    const parsed = parse8Digits_PackLemire(
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

// Consume-to-end variant using the UNSAFE PackLemire kernel. This is the
// fair test for the user's idea: in the consume-to-end path the caller has
// already bounded the digit range, so per-stride validation isn't needed —
// and the unsafe Lemire kernel is genuinely faster than my PairMul.
// @ts-expect-error: @inline
@inline function atou_PackLemireUnsafe(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 14 < srcEnd) {
    const parsed = parse8Digits_PackLemire_Unsafe(
      load<u64>(srcStart),
      load<u64>(srcStart, 8),
    );
    value = value * 100_000_000 + parsed;
    srcStart += 16;
  }
  while (srcStart < srcEnd) {
    value = value * 10 + (<u32>load<u16>(srcStart) - 48);
    srcStart += 2;
  }
  return value;
}

// Same shape as atou_PackLemireUnsafe but using my PairMul kernel for parse8.
// @ts-expect-error: @inline
@inline function atou_PairMulUnsafe(srcStart: usize, srcEnd: usize): u64 {
  let value: u64 = 0;
  while (srcStart + 14 < srcEnd) {
    const parsed = parse8Digits_PairMul(
      load<u64>(srcStart),
      load<u64>(srcStart, 8),
    );
    value = value * 100_000_000 + parsed;
    srcStart += 16;
  }
  while (srcStart < srcEnd) {
    value = value * 10 + (<u32>load<u16>(srcStart) - 48);
    srcStart += 2;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Test corpora & verify.
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

function pack4(s: string): u64 {
  let block: u64 = 0;
  for (let i = 0; i < 4; i++) block |= (<u64>s.charCodeAt(i)) << (<u64>i * 16);
  return block;
}

function verify(): void {
  // PackLemire must agree with PairMul for valid 8-digit inputs.
  const probes: u32[] = [0, 1, 99, 12345678, 99999999, 87654321, 10000001];
  for (let i = 0; i < probes.length; i++) {
    const n = unchecked(probes[i]);
    let s = n.toString();
    while (s.length < 8) s = "0" + s;
    const lo = pack4(s.substring(0, 4));
    const hi = pack4(s.substring(4, 8));
    expect<u32>(parse8Digits_PackLemire(lo, hi)).toBe(
      parse8Digits_PairMul(lo, hi),
    );
    expect<u32>(parse8Digits_PackLemire_Unsafe(lo, hi)).toBe(
      parse8Digits_PairMul(lo, hi),
    );
  }

  // Rejection: non-digit byte → MAX.
  const badLo = pack4("1a23");
  const okHi = pack4("4567");
  expect<u32>(parse8Digits_PackLemire(badLo, okHi)).toBe(U32.MAX_VALUE);

  // Rejection: non-ASCII high byte.
  const nonAsciiLo: u64 = 0x0033_0100_0032_0031;
  expect<u32>(parse8Digits_PackLemire(nonAsciiLo, okHi)).toBe(U32.MAX_VALUE);

  // Atoi cross-check.
  const inputs: string[] = [D8, D16, D32, D64];
  for (let i = 0; i < inputs.length; i++) {
    const v = unchecked(inputs[i]);
    const p = changetype<usize>(v);
    const e = p + ((<usize>v.length) << 1);
    expect<u64>(atoi_PackLemire(p, e)).toBe(atoi_PairMul(p, e));
  }
}

verify();

// ---------------------------------------------------------------------------
// Bench.
// ---------------------------------------------------------------------------

let CUR_PTR: usize = 0;
let CUR_END: usize = 0;

function kernel_PairMul(): void {
  const lo = load<u64>(CUR_PTR);
  const hi = load<u64>(CUR_PTR, 8);
  blackbox(parse8Digits_PairMul(lo, hi));
  blackbox(parse8Digits_PairMul(lo, hi));
  blackbox(parse8Digits_PairMul(lo, hi));
  blackbox(parse8Digits_PairMul(lo, hi));
}
function kernel_PackLemire(): void {
  const lo = load<u64>(CUR_PTR);
  const hi = load<u64>(CUR_PTR, 8);
  blackbox(parse8Digits_PackLemire(lo, hi));
  blackbox(parse8Digits_PackLemire(lo, hi));
  blackbox(parse8Digits_PackLemire(lo, hi));
  blackbox(parse8Digits_PackLemire(lo, hi));
}
function kernel_PackLemire_Unsafe(): void {
  const lo = load<u64>(CUR_PTR);
  const hi = load<u64>(CUR_PTR, 8);
  blackbox(parse8Digits_PackLemire_Unsafe(lo, hi));
  blackbox(parse8Digits_PackLemire_Unsafe(lo, hi));
  blackbox(parse8Digits_PackLemire_Unsafe(lo, hi));
  blackbox(parse8Digits_PackLemire_Unsafe(lo, hi));
}

function bench_PairMul(): void {
  blackbox(atoi_PairMul(CUR_PTR, CUR_END));
}
function bench_PackLemire(): void {
  blackbox(atoi_PackLemire(CUR_PTR, CUR_END));
}
function bench_PackLemireUnsafe(): void {
  blackbox(atou_PackLemireUnsafe(CUR_PTR, CUR_END));
}
function bench_PairMulUnsafe(): void {
  blackbox(atou_PairMulUnsafe(CUR_PTR, CUR_END));
}

CUR_PTR = changetype<usize>(D16);
const KERNEL_OPS: u64 = 50_000_000;
bench("Kernel parse8 PairMul (current)", kernel_PairMul, KERNEL_OPS, 32);
dumpToFile("swar-int-packed-h2h-kernel-pairmul", "parse");
bench("Kernel parse8 PackLemire (safe)", kernel_PackLemire, KERNEL_OPS, 32);
dumpToFile("swar-int-packed-h2h-kernel-packlemire", "parse");
bench(
  "Kernel parse8 PackLemire (unsafe)",
  kernel_PackLemire_Unsafe,
  KERNEL_OPS,
  32,
);
dumpToFile("swar-int-packed-h2h-kernel-packlemire-unsafe", "parse");

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
  dumpToFile("swar-int-packed-h2h-atoi-pairmul-" + w.toString(), "parse");

  bench(
    "Atoi PackLemire (" + w.toString() + "d)",
    bench_PackLemire,
    ops,
    <u64>(w * 2),
  );
  dumpToFile("swar-int-packed-h2h-atoi-packlemire-" + w.toString(), "parse");

  bench(
    "Atou PairMul unsafe (" + w.toString() + "d)",
    bench_PairMulUnsafe,
    ops,
    <u64>(w * 2),
  );
  dumpToFile(
    "swar-int-packed-h2h-atou-pairmul-unsafe-" + w.toString(),
    "parse",
  );

  bench(
    "Atou PackLemire unsafe (" + w.toString() + "d)",
    bench_PackLemireUnsafe,
    ops,
    <u64>(w * 2),
  );
  dumpToFile(
    "swar-int-packed-h2h-atou-packlemire-unsafe-" + w.toString(),
    "parse",
  );
}
