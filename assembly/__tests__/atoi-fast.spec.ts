import { describe, expect } from "as-test";
import { atoi as atoi_OLD } from "../util/atoi";
import { atou, atoi, atouScan, atoiScan } from "../util/atoi-fast";

const KEEP: string[] = [];

/**
 * Build a UTF-16 string from `s`, keep it rooted, and pack
 * `(start << 32) | end` into a `u64`.
 *
 * @param s The source string to keep alive and address.
 * @returns A `u64` packing the start pointer in the high 32 and end in low 32.
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
// Consume-to-end: type boundaries (random sweeps live in
// __fuzz__/atoi-fast.fuzz.ts).
// ---------------------------------------------------------------------------

describe("atou boundaries: zero, max for each unsigned width", () => {
  // u8
  expect(atou<u8>(startOf(range("0")), endOf(range("0")))).toBe(<u8>0);
  expect(atou<u8>(startOf(range("255")), endOf(range("255")))).toBe(<u8>255);
  // u16
  expect(atou<u16>(startOf(range("65535")), endOf(range("65535")))).toBe(
    <u16>65535,
  );
  // u32
  expect(
    atou<u32>(startOf(range("4294967295")), endOf(range("4294967295"))),
  ).toBe(<u32>4294967295);
  // u64
  expect(
    atou<u64>(
      startOf(range("18446744073709551615")),
      endOf(range("18446744073709551615")),
    ),
  ).toBe(<u64>18446744073709551615);
});

describe("atoi boundaries: min and max for each signed width", () => {
  // i8
  expect(atoi<i8>(startOf(range("-128")), endOf(range("-128")))).toBe(<i8>-128);
  expect(atoi<i8>(startOf(range("127")), endOf(range("127")))).toBe(<i8>127);
  // i16
  expect(atoi<i16>(startOf(range("-32768")), endOf(range("-32768")))).toBe(
    <i16>-32768,
  );
  expect(atoi<i16>(startOf(range("32767")), endOf(range("32767")))).toBe(
    <i16>32767,
  );
  // i32
  expect(
    atoi<i32>(startOf(range("-2147483648")), endOf(range("-2147483648"))),
  ).toBe(<i32>-2147483648);
  expect(
    atoi<i32>(startOf(range("2147483647")), endOf(range("2147483647"))),
  ).toBe(<i32>2147483647);
  // i64
  expect(
    atoi<i64>(
      startOf(range("-9223372036854775808")),
      endOf(range("-9223372036854775808")),
    ),
  ).toBe(<i64>-9223372036854775808);
  expect(
    atoi<i64>(
      startOf(range("9223372036854775807")),
      endOf(range("9223372036854775807")),
    ),
  ).toBe(<i64>9223372036854775807);
});

describe("atou narrow-type truncation matches the scalar baseline", () => {
  // Inputs larger than the target type's range should wrap consistently.
  const cases: string[] = ["255", "256", "300", "65535", "65536", "100000"];
  for (let i = 0; i < cases.length; i++) {
    const s = unchecked(cases[i]);
    const r = range(s);
    expect(atou<u8>(startOf(r), endOf(r))).toBe(
      atoi_OLD<u8>(startOf(r), endOf(r)),
    );
    expect(atou<u16>(startOf(r), endOf(r))).toBe(
      atoi_OLD<u16>(startOf(r), endOf(r)),
    );
  }
});

// ---------------------------------------------------------------------------
// Scan semantics: terminators, empty runs, narrow stores.
// ---------------------------------------------------------------------------

describe("atouScan stops at the first non-digit and stores the value", () => {
  const r = range("12345,67890");
  const slot = memory.data(8);
  const next = atouScan<u32>(startOf(r), endOf(r), slot);
  expect(load<u32>(slot)).toBe(<u32>12345);
  // Position should sit on the comma (5 digits in = 10 bytes).
  expect(next - startOf(r)).toBe(<usize>10);
});

describe("atoiScan consumes a leading minus and negates", () => {
  const r = range("-42xyz");
  const slot = memory.data(8);
  const next = atoiScan<i32>(startOf(r), endOf(r), slot);
  expect(load<i32>(slot)).toBe(<i32>-42);
  // After '-' (2B) + "42" (4B) = 6B in.
  expect(next - startOf(r)).toBe(<usize>6);
});

describe("atouScan on an empty digit run stores zero and advances nothing", () => {
  const r = range("abc");
  const slot = memory.data(8);
  store<u64>(slot, 0xdeadbeef); // poison the slot to confirm the store happens
  const next = atouScan<u32>(startOf(r), endOf(r), slot);
  expect(load<u32>(slot)).toBe(<u32>0);
  expect(next - startOf(r)).toBe(<usize>0);
});

describe("atoiScan with minus followed by non-digit stores zero and consumes only the minus", () => {
  const r = range("-abc");
  const slot = memory.data(8);
  const next = atoiScan<i32>(startOf(r), endOf(r), slot);
  expect(load<i32>(slot)).toBe(<i32>0);
  // We consumed the '-' (2 bytes) but no digits.
  expect(next - startOf(r)).toBe(<usize>2);
});

describe("atouScan exercises each SWAR stride boundary", () => {
  // Widths chosen to span the parse4 (8B), parse8 (16B), and parse16 (32B)
  // stride decisions plus their tails.
  const cases: string[] = [
    "1234", //  4 digits: scalar only
    "12345678", //  8 digits: one parse8 stride
    "1234567890", // 10 digits: one parse8 + 2 scalar
    "9999999999999", // 13 digits: one parse8 + parse4 + scalar
    "1234567890123456", // 16 digits: two parse8 strides
    "123456789012345678", // 18 digits: two parse8 + scalar
  ];
  for (let i = 0; i < cases.length; i++) {
    const s = unchecked(cases[i]);
    const r = range(s + ",");
    const slot = memory.data(8);
    const next = atouScan<u64>(startOf(r), endOf(r), slot);
    const expected = atoi_OLD<u64>(
      startOf(r),
      startOf(r) + ((<usize>s.length) << 1),
    );
    expect(load<u64>(slot)).toBe(expected);
    expect(next - startOf(r)).toBe((<usize>s.length) << 1);
  }
});

describe("atouScan stores correctly for each unsigned width", () => {
  const r = range("42");
  const slot = memory.data(8);

  store<u64>(slot, 0xffffffffffffffff);
  atouScan<u8>(startOf(r), endOf(r), slot);
  expect(load<u8>(slot)).toBe(<u8>42);

  store<u64>(slot, 0xffffffffffffffff);
  atouScan<u16>(startOf(r), endOf(r), slot);
  expect(load<u16>(slot)).toBe(<u16>42);

  store<u64>(slot, 0xffffffffffffffff);
  atouScan<u32>(startOf(r), endOf(r), slot);
  expect(load<u32>(slot)).toBe(<u32>42);

  store<u64>(slot, 0xffffffffffffffff);
  atouScan<u64>(startOf(r), endOf(r), slot);
  expect(load<u64>(slot)).toBe(<u64>42);
});
