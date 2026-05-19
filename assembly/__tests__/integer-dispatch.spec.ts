// Tests that go through the JSON_MODE dispatcher in
// `deserialize/index/integer.ts` and `deserialize/index/unsigned.ts`.
//
// The other integer spec (`atoi-fast.spec.ts`) calls through
// `util/atoi-fast.ts`, which is a thin SWAR-only shim. As a result, the
// SIMD-mode bodies in `deserialize/simd/integer.ts` are never reached and
// show as uncovered. This file calls the dispatchers directly so the same
// inputs exercise SWAR in SWAR mode AND SIMD in SIMD mode.
//
// Inputs are chosen to hit each tiered stride that lives behind the
// dispatcher: parse4 success in signed scan, parse8 success in unsigned
// scan, parse16 success in consume-to-end, plus the leading-minus consume
// in scan paths.

import { describe, expect } from "as-test";
import {
  deserializeInteger,
  deserializeIntegerField,
} from "../deserialize/index/integer";
import {
  deserializeUnsigned,
  deserializeUnsignedField,
} from "../deserialize/index/unsigned";

const KEEP: string[] = [];

/**
 * Build a UTF-16 string, keep it rooted, and pack `(start << 32) | end`.
 *
 * @param s The source string.
 * @returns A `u64` packing the start pointer and end pointer.
 */
function range(s: string): u64 {
  KEEP.push(s);
  const start = changetype<usize>(s);
  const end = start + ((<usize>s.length) << 1);
  return ((<u64>start) << 32) | (<u64>end);
}

// @ts-expect-error: @inline is a valid decorator
@inline function startOf(r: u64): usize {
  return <usize>(r >> 32);
}

// @ts-expect-error: @inline is a valid decorator
@inline function endOf(r: u64): usize {
  return <usize>(r & 0xffffffff);
}

// ---------------------------------------------------------------------------
// Consume-to-end via the dispatcher. The mode-specific consume paths run
// the parse16/parse8/parse4 strides unsafely (no per-stride validation), so
// inputs must be all digits.
// ---------------------------------------------------------------------------

describe("deserializeUnsigned dispatcher parses 4-digit input correctly", () => {
  // 4 digits: only the parse4 stride and scalar tail fire.
  const r = range("1234");
  expect(deserializeUnsigned<u32>(startOf(r), endOf(r))).toBe(<u32>1234);
});

describe("deserializeUnsigned dispatcher parses 8-digit input correctly", () => {
  // 8 digits: parse8 stride fires once cleanly.
  const r = range("12345678");
  expect(deserializeUnsigned<u32>(startOf(r), endOf(r))).toBe(<u32>12345678);
});

describe("deserializeUnsigned dispatcher parses 16-digit input correctly", () => {
  // 16 digits: parse16 stride fires once cleanly (consume path keeps parse16
  // because the caller has bounded the digit range).
  const r = range("1234567890123456");
  expect(deserializeUnsigned<u64>(startOf(r), endOf(r))).toBe(
    <u64>1234567890123456,
  );
});

describe("deserializeUnsigned dispatcher parses a 19-digit u64 max", () => {
  const r = range("18446744073709551615");
  expect(deserializeUnsigned<u64>(startOf(r), endOf(r))).toBe(
    <u64>18446744073709551615,
  );
});

describe("deserializeInteger dispatcher parses signed negative through tiered path", () => {
  // 17 digits after the minus: triggers parse16 + parse4 strides + negation.
  const r = range("-12345678901234567");
  expect(deserializeInteger<i64>(startOf(r), endOf(r))).toBe(
    <i64>-12345678901234567,
  );
});

describe("deserializeInteger dispatcher handles signed positive and zero", () => {
  const rPos = range("42");
  expect(deserializeInteger<i32>(startOf(rPos), endOf(rPos))).toBe(<i32>42);
  const rZero = range("0");
  expect(deserializeInteger<i32>(startOf(rZero), endOf(rZero))).toBe(<i32>0);
});

// ---------------------------------------------------------------------------
// Scan-to-non-digit via the dispatcher. The dispatcher's scan path validates
// per-stride and stops at the first non-digit. Each input below targets a
// specific stride success in either the SWAR or SIMD body.
// ---------------------------------------------------------------------------

describe("deserializeUnsignedField dispatcher hits parse8 stride on 8-digit run", () => {
  // 8 digits + terminator: parse8 fires once successfully, scalar tail exits
  // on the comma. Covers parse8 success in both swar/integer.ts and
  // simd/integer.ts depending on JSON_MODE.
  const r = range("12345678,");
  const slot = memory.data(8);
  // Call with three args (omit dstOffset) to exercise the dispatcher's
  // default-value path as well.
  const next = deserializeUnsignedField<u32>(startOf(r), endOf(r), slot);
  expect(load<u32>(slot)).toBe(<u32>12345678);
  // 8 digits consumed = 16 bytes; position should sit on the comma.
  expect(next - startOf(r)).toBe(<usize>16);
});

describe("deserializeIntegerField dispatcher hits parse4 stride after minus", () => {
  // "-12345,": minus consume, then 5 digits. parse4 fires once for "1234"
  // (success), scalar tail handles "5" then exits on the comma. Covers the
  // parse4 stride success in the SIGNED scan path of both modes.
  const r = range("-12345,");
  const slot = memory.data(8);
  const next = deserializeIntegerField<i32>(startOf(r), endOf(r), slot);
  expect(load<i32>(slot)).toBe(<i32>-12345);
  // 1 minus + 5 digits consumed = 12 bytes.
  expect(next - startOf(r)).toBe(<usize>12);
});

describe("deserializeUnsignedField dispatcher handles plain-scalar short input", () => {
  // 3 digits + terminator: shorter than any SWAR stride, only the scalar
  // tail fires. Confirms the scan path correctly degrades.
  const r = range("123,");
  const slot = memory.data(8);
  const next = deserializeUnsignedField<u8>(startOf(r), endOf(r), slot);
  expect(load<u8>(slot)).toBe(<u8>123);
  expect(next - startOf(r)).toBe(<usize>6);
});

describe("deserializeIntegerField dispatcher round-trips i64 min and max", () => {
  // i64 max: 19 digits, exercises parse16 + parse4 + scalar through the
  // signed consume path.
  const rMax = range("9223372036854775807,");
  const slotMax = memory.data(8);
  deserializeIntegerField<i64>(startOf(rMax), endOf(rMax), slotMax);
  expect(load<i64>(slotMax)).toBe(<i64>9223372036854775807);

  // i64 min: 19 digits + minus, exercises full signed tail.
  const rMin = range("-9223372036854775808,");
  const slotMin = memory.data(8);
  deserializeIntegerField<i64>(startOf(rMin), endOf(rMin), slotMin);
  expect(load<i64>(slotMin)).toBe(<i64>-9223372036854775808);
});
