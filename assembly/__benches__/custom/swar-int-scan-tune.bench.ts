// Focused tuning bench for the scan path. Compares several variants within
// a single process for stable noise. Tests sweep widths 4, 8, 10, 16, 19,
// 20, 32 across u32/u64 unsigned and i32/i64 signed.

import { bench, blackbox, dumpToFile } from "../lib/bench";
import { expect } from "../../__tests__/lib";
import {
  parse4Digits_PairMul,
  parse8Digits_PairMul,
  parse16Digits_SWAR,
} from "../../util/swar-int";
import { deserializeUnsignedField as OLD_uField } from "../../deserialize/simple/unsigned";
import { deserializeIntegerField as OLD_iField } from "../../deserialize/simple/integer";

const ASCII_MINUS: u16 = 45;
const ASCII_ZERO: u16 = 48;

// @ts-expect-error: @inline is a valid decorator
@inline function storeSigned<T extends number>(
  dstPtr: usize,
  value: u64,
): void {
  if (sizeof<T>() == 4) store<i32>(dstPtr, <i32>value);
  else store<i64>(dstPtr, <i64>value);
}
// @ts-expect-error: @inline is a valid decorator
@inline function storeUnsigned<T extends number>(
  dstPtr: usize,
  value: u64,
): void {
  if (sizeof<T>() == 4) store<u32>(dstPtr, <u32>value);
  else store<u64>(dstPtr, value);
}

// Current production (parse8 +14< then parse4 +6< then scalar).
// @ts-expect-error: @inline is a valid decorator
@inline function uScan_Current<T extends number>(
  s: usize,
  e: usize,
  dst: usize,
): usize {
  let v: u64 = 0;
  while (s + 14 < e) {
    const p = parse8Digits_PairMul(load<u64>(s), load<u64>(s, 8));
    if (p == U32.MAX_VALUE) break;
    v = v * 100_000_000 + p;
    s += 16;
  }
  while (s + 6 < e) {
    const p = parse4Digits_PairMul(load<u64>(s));
    if (p == U32.MAX_VALUE) break;
    v = v * 10_000 + p;
    s += 8;
  }
  while (s < e) {
    const d = <u32>load<u16>(s) - ASCII_ZERO;
    if (d > 9) break;
    v = v * 10 + d;
    s += 2;
  }
  storeUnsigned<T>(dst, v);
  return s;
}

// V2: parse4 only (no parse8).
// @ts-expect-error: @inline is a valid decorator
@inline function uScan_P4Only<T extends number>(
  s: usize,
  e: usize,
  dst: usize,
): usize {
  let v: u64 = 0;
  while (s + 6 < e) {
    const p = parse4Digits_PairMul(load<u64>(s));
    if (p == U32.MAX_VALUE) break;
    v = v * 10_000 + p;
    s += 8;
  }
  while (s < e) {
    const d = <u32>load<u16>(s) - ASCII_ZERO;
    if (d > 9) break;
    v = v * 10 + d;
    s += 2;
  }
  storeUnsigned<T>(dst, v);
  return s;
}

// V3: parse8 only (no parse4 fallback, straight to scalar).
// @ts-expect-error: @inline is a valid decorator
@inline function uScan_P8OnlyScalar<T extends number>(
  s: usize,
  e: usize,
  dst: usize,
): usize {
  let v: u64 = 0;
  while (s + 14 < e) {
    const p = parse8Digits_PairMul(load<u64>(s), load<u64>(s, 8));
    if (p == U32.MAX_VALUE) break;
    v = v * 100_000_000 + p;
    s += 16;
  }
  while (s < e) {
    const d = <u32>load<u16>(s) - ASCII_ZERO;
    if (d > 9) break;
    v = v * 10 + d;
    s += 2;
  }
  storeUnsigned<T>(dst, v);
  return s;
}

// V4: parse8 +22< tighter gate, then parse4 +6<.
// @ts-expect-error: @inline is a valid decorator
@inline function uScan_P8Tight<T extends number>(
  s: usize,
  e: usize,
  dst: usize,
): usize {
  let v: u64 = 0;
  while (s + 22 < e) {
    const p = parse8Digits_PairMul(load<u64>(s), load<u64>(s, 8));
    if (p == U32.MAX_VALUE) break;
    v = v * 100_000_000 + p;
    s += 16;
  }
  while (s + 6 < e) {
    const p = parse4Digits_PairMul(load<u64>(s));
    if (p == U32.MAX_VALUE) break;
    v = v * 10_000 + p;
    s += 8;
  }
  while (s < e) {
    const d = <u32>load<u16>(s) - ASCII_ZERO;
    if (d > 9) break;
    v = v * 10 + d;
    s += 2;
  }
  storeUnsigned<T>(dst, v);
  return s;
}

// Signed wrappers (just prepend minus consume).
// @ts-expect-error: @inline is a valid decorator
@inline function iScan_Current<T extends number>(
  s: usize,
  e: usize,
  dst: usize,
): usize {
  let neg = false;
  if (s < e && load<u16>(s) == ASCII_MINUS) {
    neg = true;
    s += 2;
  }
  let v: u64 = 0;
  while (s + 14 < e) {
    const p = parse8Digits_PairMul(load<u64>(s), load<u64>(s, 8));
    if (p == U32.MAX_VALUE) break;
    v = v * 100_000_000 + p;
    s += 16;
  }
  while (s + 6 < e) {
    const p = parse4Digits_PairMul(load<u64>(s));
    if (p == U32.MAX_VALUE) break;
    v = v * 10_000 + p;
    s += 8;
  }
  while (s < e) {
    const d = <u32>load<u16>(s) - ASCII_ZERO;
    if (d > 9) break;
    v = v * 10 + d;
    s += 2;
  }
  storeSigned<T>(dst, neg ? 0 - v : v);
  return s;
}

// @ts-expect-error: @inline is a valid decorator
@inline function iScan_P4Only<T extends number>(
  s: usize,
  e: usize,
  dst: usize,
): usize {
  let neg = false;
  if (s < e && load<u16>(s) == ASCII_MINUS) {
    neg = true;
    s += 2;
  }
  let v: u64 = 0;
  while (s + 6 < e) {
    const p = parse4Digits_PairMul(load<u64>(s));
    if (p == U32.MAX_VALUE) break;
    v = v * 10_000 + p;
    s += 8;
  }
  while (s < e) {
    const d = <u32>load<u16>(s) - ASCII_ZERO;
    if (d > 9) break;
    v = v * 10 + d;
    s += 2;
  }
  storeSigned<T>(dst, neg ? 0 - v : v);
  return s;
}

// @ts-expect-error: @inline is a valid decorator
@inline function iScan_P8Tight<T extends number>(
  s: usize,
  e: usize,
  dst: usize,
): usize {
  let neg = false;
  if (s < e && load<u16>(s) == ASCII_MINUS) {
    neg = true;
    s += 2;
  }
  let v: u64 = 0;
  while (s + 22 < e) {
    const p = parse8Digits_PairMul(load<u64>(s), load<u64>(s, 8));
    if (p == U32.MAX_VALUE) break;
    v = v * 100_000_000 + p;
    s += 16;
  }
  while (s + 6 < e) {
    const p = parse4Digits_PairMul(load<u64>(s));
    if (p == U32.MAX_VALUE) break;
    v = v * 10_000 + p;
    s += 8;
  }
  while (s < e) {
    const d = <u32>load<u16>(s) - ASCII_ZERO;
    if (d > 9) break;
    v = v * 10 + d;
    s += 2;
  }
  storeSigned<T>(dst, neg ? 0 - v : v);
  return s;
}

// ---------------------------------------------------------------------------
// Corpora: all sweeps with trailing ",".
// ---------------------------------------------------------------------------

function buildU(n: i32): string {
  let s = "";
  while (s.length < n) s += "1234567890";
  return s.substring(0, n) + ",";
}
function buildI(n: i32): string {
  return "-" + buildU(n - 1).slice(0, n - 1) + ",";
}

const WIDTHS: i32[] = [4, 8, 10, 16, 19, 20, 32];
const uInputs: string[] = [];
const iInputs: string[] = [];
for (let i = 0; i < WIDTHS.length; i++) {
  uInputs.push(buildU(unchecked(WIDTHS[i])));
  iInputs.push(buildI(unchecked(WIDTHS[i])));
}

let CUR_PTR: usize = 0;
let CUR_END: usize = 0;
const SLOT = memory.data(16);

// ---------------------------------------------------------------------------
// Verify all variants match production for valid inputs.
// ---------------------------------------------------------------------------

function verify(): void {
  const slotA = memory.data(16);
  const slotB = memory.data(16);
  for (let i = 0; i < uInputs.length; i++) {
    const v = unchecked(uInputs[i]);
    const p = changetype<usize>(v);
    const e = p + ((<usize>v.length) << 1);
    const nProd = OLD_uField<u64>(p, e, slotA, 0);
    const nCurrent = uScan_Current<u64>(p, e, slotB);
    const nP4 = uScan_P4Only<u64>(p, e, slotB);
    const nP8 = uScan_P8OnlyScalar<u64>(p, e, slotB);
    const nP8Tight = uScan_P8Tight<u64>(p, e, slotB);
    expect<u64>(nCurrent - p).toBe(nProd - p);
    expect<u64>(nP4 - p).toBe(nProd - p);
    expect<u64>(nP8 - p).toBe(nProd - p);
    expect<u64>(nP8Tight - p).toBe(nProd - p);
  }
  for (let i = 0; i < iInputs.length; i++) {
    const v = unchecked(iInputs[i]);
    const p = changetype<usize>(v);
    const e = p + ((<usize>v.length) << 1);
    const nProd = OLD_iField<i64>(p, e, slotA, 0);
    const nCurrent = iScan_Current<i64>(p, e, slotB);
    const nP4 = iScan_P4Only<i64>(p, e, slotB);
    const nP8Tight = iScan_P8Tight<i64>(p, e, slotB);
    expect<u64>(nCurrent - p).toBe(nProd - p);
    expect<u64>(nP4 - p).toBe(nProd - p);
    expect<u64>(nP8Tight - p).toBe(nProd - p);
  }
}

verify();

// ---------------------------------------------------------------------------
// Bench.
// ---------------------------------------------------------------------------

// Unsigned u64 bench routines (separate per variant so the kernel inlines).
function u_OLD(): void {
  blackbox(OLD_uField<u64>(CUR_PTR, CUR_END, SLOT, 0));
}
function u_Current(): void {
  blackbox(uScan_Current<u64>(CUR_PTR, CUR_END, SLOT));
}
function u_P4(): void {
  blackbox(uScan_P4Only<u64>(CUR_PTR, CUR_END, SLOT));
}
function u_P8(): void {
  blackbox(uScan_P8OnlyScalar<u64>(CUR_PTR, CUR_END, SLOT));
}
function u_P8Tight(): void {
  blackbox(uScan_P8Tight<u64>(CUR_PTR, CUR_END, SLOT));
}

function i_OLD(): void {
  blackbox(OLD_iField<i64>(CUR_PTR, CUR_END, SLOT, 0));
}
function i_Current(): void {
  blackbox(iScan_Current<i64>(CUR_PTR, CUR_END, SLOT));
}
function i_P4(): void {
  blackbox(iScan_P4Only<i64>(CUR_PTR, CUR_END, SLOT));
}
function i_P8Tight(): void {
  blackbox(iScan_P8Tight<i64>(CUR_PTR, CUR_END, SLOT));
}

const OPS: u64 = 30_000_000;

for (let i = 0; i < WIDTHS.length; i++) {
  const w = unchecked(WIDTHS[i]);

  // Unsigned
  const uv = unchecked(uInputs[i]);
  CUR_PTR = changetype<usize>(uv);
  CUR_END = CUR_PTR + ((<usize>uv.length) << 1);

  bench("u64 OLD       (" + w.toString() + "d)", u_OLD, OPS, <u64>(w * 2));
  bench("u64 Current   (" + w.toString() + "d)", u_Current, OPS, <u64>(w * 2));
  bench("u64 P4Only    (" + w.toString() + "d)", u_P4, OPS, <u64>(w * 2));
  bench("u64 P8Scalar  (" + w.toString() + "d)", u_P8, OPS, <u64>(w * 2));
  bench("u64 P8Tight   (" + w.toString() + "d)", u_P8Tight, OPS, <u64>(w * 2));

  // Signed
  const iv = unchecked(iInputs[i]);
  CUR_PTR = changetype<usize>(iv);
  CUR_END = CUR_PTR + ((<usize>iv.length) << 1);

  bench("i64 OLD       (" + w.toString() + "d)", i_OLD, OPS, <u64>(w * 2));
  bench("i64 Current   (" + w.toString() + "d)", i_Current, OPS, <u64>(w * 2));
  bench("i64 P4Only    (" + w.toString() + "d)", i_P4, OPS, <u64>(w * 2));
  bench("i64 P8Tight   (" + w.toString() + "d)", i_P8Tight, OPS, <u64>(w * 2));
}

dumpToFile("swar-int-scan-tune", "parse");
