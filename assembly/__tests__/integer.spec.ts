import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Should serialize integers", () => {
  expect(JSON.stringify(0)).toBe("0");

  expect(JSON.stringify<u32>(100)).toBe("100");

  expect(JSON.stringify<u64>(101)).toBe("101");

  expect(JSON.stringify<i32>(-100)).toBe("-100");

  expect(JSON.stringify<i64>(-101)).toBe("-101");
});

describe("Should deserialize integers", () => {
  expect(JSON.parse<i32>("0").toString()).toBe("0");

  expect(JSON.parse<u32>("100").toString()).toBe("100");

  expect(JSON.parse<u64>("101").toString()).toBe("101");

  expect(JSON.parse<i32>("-100").toString()).toBe("-100");

  expect(JSON.parse<i64>("-101").toString()).toBe("-101");
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe(
    '"regression"',
  );
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe(
    '["a","b","c"]',
  );
});

describe("Should serialize integer boundaries", () => {
  expect(JSON.stringify<i32>(2147483647)).toBe("2147483647");
  expect(JSON.stringify<i32>(-2147483648)).toBe("-2147483648");
  expect(JSON.stringify<u32>(4294967295)).toBe("4294967295");
});

describe("Should deserialize integer boundaries", () => {
  expect(JSON.parse<i32>("2147483647").toString()).toBe("2147483647");
  expect(JSON.parse<i32>("-2147483648").toString()).toBe("-2147483648");
  expect(JSON.parse<u32>("4294967295").toString()).toBe("4294967295");
});

describe("Should round-trip a wider signed integer matrix", () => {
  expect(JSON.stringify(JSON.parse<i64>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<i64>("1"))).toBe("1");
  expect(JSON.stringify(JSON.parse<i64>("-1"))).toBe("-1");
  expect(JSON.stringify(JSON.parse<i64>("7"))).toBe("7");
  expect(JSON.stringify(JSON.parse<i64>("-7"))).toBe("-7");
  expect(JSON.stringify(JSON.parse<i64>("10"))).toBe("10");
  expect(JSON.stringify(JSON.parse<i64>("-10"))).toBe("-10");
  expect(JSON.stringify(JSON.parse<i64>("999"))).toBe("999");
  expect(JSON.stringify(JSON.parse<i64>("-999"))).toBe("-999");
  expect(JSON.stringify(JSON.parse<i64>("123456789"))).toBe("123456789");
  expect(JSON.stringify(JSON.parse<i64>("-123456789"))).toBe("-123456789");
  expect(JSON.stringify(JSON.parse<i64>("9223372036854775807"))).toBe(
    "9223372036854775807",
  );
  expect(JSON.stringify(JSON.parse<i64>("-9223372036854775808"))).toBe(
    "-9223372036854775808",
  );
});

describe("Should round-trip a wider unsigned integer matrix", () => {
  expect(JSON.stringify(JSON.parse<u64>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<u64>("1"))).toBe("1");
  expect(JSON.stringify(JSON.parse<u64>("7"))).toBe("7");
  expect(JSON.stringify(JSON.parse<u64>("10"))).toBe("10");
  expect(JSON.stringify(JSON.parse<u64>("999"))).toBe("999");
  expect(JSON.stringify(JSON.parse<u64>("123456789"))).toBe("123456789");
  expect(JSON.stringify(JSON.parse<u64>("18446744073709551615"))).toBe(
    "18446744073709551615",
  );
});

describe("Should handle integer whitespace and zero variants", () => {
  expect(JSON.stringify(JSON.parse<u32>("00042"))).toBe("42");
  expect(JSON.stringify(JSON.parse<i32[]>("[0,-1,2,-3,4]"))).toBe(
    "[0,-1,2,-3,4]",
  );
  expect(JSON.stringify(JSON.parse<i32[]>("[ 0 , -1 , 2 , -3 , 4 ]"))).toBe(
    "[0,-1,2,-3,4]",
  );
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe(
    "[[1],[2,3],[]]",
  );
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe(
    '"line\\nbreak"',
  );
});

describe("Should exercise each tiered stride in the integer dispatcher", () => {
  // Each input below targets a specific stride success in the tiered
  // SWAR/SIMD scan paths that live behind deserialize/index/integer.ts
  // and deserialize/index/unsigned.ts. Going through JSON.parse means
  // SWAR mode hits the SWAR body and SIMD mode hits the SIMD body
  // - same shape, different stride implementation.

  // 4-digit unsigned: parse4 stride + scalar tail.
  expect(JSON.parse<u32>("1234")).toBe(<u32>1234);

  // 8-digit unsigned: parse8 stride fires cleanly.
  expect(JSON.parse<u32>("12345678")).toBe(<u32>12345678);

  // 16-digit unsigned: parse16 stride fires cleanly (consume-to-end path).
  expect(JSON.parse<u64>("1234567890123456")).toBe(<u64>1234567890123456);

  // 19-digit unsigned: parse16 + parse4 + scalar, hits u64 max.
  expect(JSON.parse<u64>("18446744073709551615")).toBe(
    <u64>18446744073709551615,
  );

  // 17-digit signed negative: parse16 + parse4 + scalar + negation.
  expect(JSON.parse<i64>("-12345678901234567")).toBe(<i64>-12345678901234567);

  // 3-digit unsigned: shorter than any SWAR stride, only the scalar tail
  // fires. Confirms the scan path correctly degrades on short inputs.
  expect(JSON.parse<u8>("123")).toBe(<u8>123);

  // Signed positive 2-digit and zero.
  expect(JSON.parse<i32>("42")).toBe(<i32>42);
  expect(JSON.parse<i32>("0")).toBe(<i32>0);

  // i64 boundary: full signed consume path.
  expect(JSON.parse<i64>("9223372036854775807")).toBe(<i64>9223372036854775807);
  expect(JSON.parse<i64>("-9223372036854775808")).toBe(
    <i64>-9223372036854775808,
  );

  // Narrow unsigned/signed stores via JSON.parse.
  expect(JSON.parse<u16>("65535")).toBe(<u16>65535);
  expect(JSON.parse<u32>("4294967295")).toBe(<u32>4294967295);
  expect(JSON.parse<i32>("-12345")).toBe(<i32>-12345);
});

describe("Should exercise SWAR/SIMD integer array bodies through JSON.parse", () => {
  // Unsigned wide payload: drives the parse4/parse8 element paths in
  // both SWAR and SIMD array variants.
  const unsigned = JSON.parse<u32[]>("[1234,5678,90]");
  expect(unsigned.length).toBe(3);
  expect(unsigned[0]).toBe(<u32>1234);
  expect(unsigned[1]).toBe(<u32>5678);
  expect(unsigned[2]).toBe(<u32>90);

  // Signed mixed-width: scalar negation + parse4.
  const signed = JSON.parse<i32[]>("[-12345,67,-8901]");
  expect(signed.length).toBe(3);
  expect(signed[0]).toBe(<i32>-12345);
  expect(signed[1]).toBe(<i32>67);
  expect(signed[2]).toBe(<i32>-8901);

  // Narrow lane (u8 with packed commas): the SIMD lane-tightening
  // special case for i8/u8/i16/u16 only fires here.
  const narrow = JSON.parse<u8[]>("[255,42,7]");
  expect(narrow.length).toBe(3);
  expect(narrow[0]).toBe(<u8>255);
  expect(narrow[1]).toBe(<u8>42);
  expect(narrow[2]).toBe(<u8>7);

  // Narrow signed lane, 3-element packed.
  const narrowSigned = JSON.parse<i8[]>("[-12,-34,-5]");
  expect(narrowSigned.length).toBe(3);
  expect(narrowSigned[0]).toBe(<i8>-12);
  expect(narrowSigned[1]).toBe(<i8>-34);
  expect(narrowSigned[2]).toBe(<i8>-5);

  // Wide SIMD payload: parse8/parse16 element strides.
  const wide = JSON.parse<u32[]>("[12345678,87654321,42]");
  expect(wide.length).toBe(3);
  expect(wide[0]).toBe(<u32>12345678);
  expect(wide[1]).toBe(<u32>87654321);
  expect(wide[2]).toBe(<u32>42);

  // Wide signed: full parse16 + parse4 + scalar negation through array.
  const signedWide = JSON.parse<i64[]>("[-12345678901234567,42,-5]");
  expect(signedWide.length).toBe(3);
  expect(signedWide[0]).toBe(<i64>-12345678901234567);
  expect(signedWide[1]).toBe(<i64>42);
  expect(signedWide[2]).toBe(<i64>-5);

  // Empty array short-circuit.
  expect(JSON.parse<i32[]>("[]").length).toBe(0);
});


@json
class IntegerArrayFieldBox {
  values: i32[] = [7];
}


@json
class IntegerFieldBox {
  signed8: i8 = 0;
  unsigned8: u8 = 0;
  signed16: i16 = 0;
  unsigned16: u16 = 0;
  signed32: i32 = 0;
  unsigned32: u32 = 0;
  signed64: i64 = 0;
  unsigned64: u64 = 0;
}

describe("Should round-trip integer struct fields across every width and sign", () => {
  // Drives both the signed and unsigned single-field integer paths in
  // NAIVE/SWAR/SIMD modes. Each width covers a different store branch
  // (i8/i16/i32/i64) and the negative path forces the leading-minus
  // consumer to fire.
  const box = JSON.parse<IntegerFieldBox>(
    '{"signed8":-128,"unsigned8":255,"signed16":-32768,"unsigned16":65535,"signed32":-2147483648,"unsigned32":4294967295,"signed64":-9223372036854775808,"unsigned64":18446744073709551615}',
  );
  expect(box.signed8).toBe(<i8>-128);
  expect(box.unsigned8).toBe(<u8>255);
  expect(box.signed16).toBe(<i16>-32768);
  expect(box.unsigned16).toBe(<u16>65535);
  expect(box.signed32).toBe(<i32>-2147483648);
  expect(box.unsigned32).toBe(<u32>4294967295);
  expect(box.signed64).toBe(<i64>-9223372036854775808);
  expect(box.unsigned64).toBe(<u64>18446744073709551615);
});

describe("Should reuse pre-seeded integer array fields through JSON.parse", () => {
  // IntegerArrayFieldBox is pre-seeded with [7], driving the SWAR/SIMD
  // field-into reuse path: the existing array gets cleared and refilled.
  const populated = JSON.parse<IntegerArrayFieldBox>(
    '{"values":[1000,-2000,3000]}',
  );
  expect(populated.values.length).toBe(3);
  expect(populated.values[0]).toBe(1000);
  expect(populated.values[1]).toBe(-2000);
  expect(populated.values[2]).toBe(3000);

  const empty = JSON.parse<IntegerArrayFieldBox>('{"values":[]}');
  expect(empty.values.length).toBe(0);

  const spaced = JSON.parse<IntegerArrayFieldBox>(
    '{"values":[ 11 , 22 , 33 ]}',
  );
  expect(spaced.values.length).toBe(3);
  expect(spaced.values[0]).toBe(11);
  expect(spaced.values[2]).toBe(33);
});

// ─── helpers ──────────────────────────────────────────────────────────────────

@json
class UintVec {
  values: u32[] = [];
}

// ─── SWAR integer array edge cases ───────────────────────────────────────────

describe("SWAR: i8[] parses negative values correctly", () => {
  expect(JSON.stringify(JSON.parse<i8[]>("[-128,0,127]"))).toBe("[-128,0,127]");
});

describe("SWAR: u8[] single-digit values", () => {
  expect(JSON.stringify(JSON.parse<u8[]>("[5,9,7]"))).toBe("[5,9,7]");
});

describe("SWAR: i16[] round-trips", () => {
  expect(JSON.stringify(JSON.parse<i16[]>("[-32768,0,32767]"))).toBe(
    "[-32768,0,32767]",
  );
});

describe("SWAR: i64[] round-trips with small values", () => {
  expect(JSON.stringify(JSON.parse<i64[]>("[0,-100,100]"))).toBe(
    "[0,-100,100]",
  );
});

describe("SWAR: u64[] round-trips with small values", () => {
  expect(JSON.stringify(JSON.parse<u64[]>("[0,100,200]"))).toBe("[0,100,200]");
});

describe("SWAR: i32[] round-trips", () => {
  expect(JSON.stringify(JSON.parse<i32[]>("[1,-2,3]"))).toBe("[1,-2,3]");
});

// swar/array/integer.ts: SWAR reuse path (useSWAR && reusableLength != 0)
describe("SWAR: i32[] reparse into existing array covers signed SWAR reuse path", () => {
  const a = JSON.parse<i32[]>("[1,2,3]");
  expect(a.length).toBe(3);
  const b = JSON.parse<i32[]>("[4,5,6]", a);
  expect(b.length).toBe(3);
  expect(b[0]).toBe(4);
  expect(b[2]).toBe(6);
});

describe("SWAR: u32[] reparse with 6-digit numbers covers unsigned SWAR reuse path with SWAR batch and scalar tail", () => {
  const a = JSON.parse<u32[]>("[123456,789012]");
  expect(a.length).toBe(2);
  const b = JSON.parse<u32[]>("[234567,890123]", a);
  expect(b.length).toBe(2);
  expect(b[0]).toBe(234567);
  expect(b[1]).toBe(890123);
});

describe("SWAR: i32[] reparse with negatives covers negative branch in SWAR reuse path", () => {
  const a = JSON.parse<i32[]>("[1,2,3]");
  const b = JSON.parse<i32[]>("[-1,-2,-3]", a);
  expect(b.length).toBe(3);
  expect(b[0]).toBe(-1);
  expect(b[2]).toBe(-3);
});

describe("SWAR: i32[] reparse with 6-digit numbers covers SWAR 4-digit batch and scalar tail", () => {
  const a = JSON.parse<i32[]>("[123456,789012]");
  const b = JSON.parse<i32[]>("[234567,890123]", a);
  expect(b[0]).toBe(234567);
  expect(b[1]).toBe(890123);
});

describe("SWAR: i32[] reparse larger-than-capacity array bails reuse path correctly", () => {
  const a = JSON.parse<i32[]>("[1,2]");
  const b = JSON.parse<i32[]>("[1,2,3]", a);
  expect(b.length).toBe(3);
  expect(b[2]).toBe(3);
});

describe("SWAR: u32[] reparse larger-than-capacity array covers unsigned capacity overflow path", () => {
  const a = JSON.parse<u32[]>("[1,2]");
  const b = JSON.parse<u32[]>("[1,2,3]", a);
  expect(b.length).toBe(3);
  expect(b[2]).toBe(3);
});

// swar/array/integer.ts: SLOW path unsigned branch via whitespace
describe("SWAR: u32[] with internal whitespace triggers SLOW unsigned path", () => {
  const a = JSON.parse<u32[]>("[ 10, 20, 30 ]");
  expect(a.length).toBe(3);
  expect(a[0]).toBe(10);
  expect(a[2]).toBe(30);
});

// swar/array/integer.ts: empty array in SLOW path and reuse path
describe("SWAR: i32[] with only whitespace covers SLOW empty-array early return", () => {
  const a = JSON.parse<i32[]>("[  ]");
  expect(a.length).toBe(0);
});

describe("SWAR: i32[] empty reparse into existing array covers reuse empty-array return", () => {
  const a = JSON.parse<i32[]>("[1,2,3]");
  const b = JSON.parse<i32[]>("[]", a);
  expect(b.length).toBe(0);
});

// naive/array/integer.ts: trailing whitespace stripping loop
describe("NAIVE: i32[] with trailing whitespace covers deserializeIntegerArray_NAIVE trailing loop", () => {
  const a = JSON.parse<i32[]>("[1,2,3]   ");
  expect(a.length).toBe(3);
  expect(a[0]).toBe(1);
  expect(a[2]).toBe(3);
});

// simd/array/integer.ts: deserializeNarrowIntegerArray_SIMD switch cases
// The narrow-u8 SIMD path loads a v128 block from srcStart and switches on the
// comma bitmask. These tests trigger the remaining five cases.
describe("SIMD: u8[] narrow-array case 0x88 (3+3 digit pair) covered by [255,100,5]", () => {
  const a = JSON.parse<u8[]>("[255,100,5]");
  expect(a.length).toBe(3);
  expect(a[0]).toBe(255);
  expect(a[1]).toBe(100);
  expect(a[2]).toBe(5);
});

describe("SIMD: u8[] narrow-array case 0x44 (2+3 digit pair) covered by [255,100,12,123,5]", () => {
  const a = JSON.parse<u8[]>("[255,100,12,123,5]");
  expect(a.length).toBe(5);
  expect(a[0]).toBe(255);
  expect(a[1]).toBe(100);
  expect(a[2]).toBe(12);
  expect(a[3]).toBe(123);
  expect(a[4]).toBe(5);
});

describe("SIMD: u8[] narrow-array case 0x24 (2+2 digit pair) covered by [255,100,12,34,50]", () => {
  const a = JSON.parse<u8[]>("[255,100,12,34,50]");
  expect(a.length).toBe(5);
  expect(a[0]).toBe(255);
  expect(a[1]).toBe(100);
  expect(a[2]).toBe(12);
  expect(a[3]).toBe(34);
  expect(a[4]).toBe(50);
});

describe("SIMD: u8[] narrow-array case 0x28 (3+1 digit pair) covered by [255,100,123,4,50]", () => {
  const a = JSON.parse<u8[]>("[255,100,123,4,50]");
  expect(a.length).toBe(5);
  expect(a[0]).toBe(255);
  expect(a[1]).toBe(100);
  expect(a[2]).toBe(123);
  expect(a[3]).toBe(4);
  expect(a[4]).toBe(50);
});

describe("SIMD: u8[] narrow-array case 0x22 (1+3 digit pair) covered by [255,100,1,234,50]", () => {
  const a = JSON.parse<u8[]>("[255,100,1,234,50]");
  expect(a.length).toBe(5);
  expect(a[0]).toBe(255);
  expect(a[1]).toBe(100);
  expect(a[2]).toBe(1);
  expect(a[3]).toBe(234);
  expect(a[4]).toBe(50);
});

// simd/array/integer.ts: parseUnsignedIntegerSIMD SIMD 8-digit loop
// A 9-digit value causes tryParseEightDigitsSIMD to succeed on the first pass.
// Lines 145-146 (value = next; srcStart += 16) fire on that successful SIMD parse.
describe("SIMD: u32[] with 9-digit value covers parseUnsignedIntegerSIMD SIMD 8-digit loop", () => {
  const a = JSON.parse<u32[]>("[100000000,5]");
  expect(a.length).toBe(2);
  expect(a[0]).toBe(100000000);
  expect(a[1]).toBe(5);
});

// simd/array/integer.ts: reuse path with 9-digit value
// When JSON.parse is called with an existing array (reusableLength != 0), the
// do-while reuse block runs. A 9-digit value triggers the SIMD 8-digit sub-loop.
describe("SIMD: u32[] reuse path with 9-digit value covers reuse unsigned SIMD loop (lines 473-474)", () => {
  const existing = new Array<u32>(3);
  existing[0] = 0;
  existing[1] = 0;
  existing[2] = 0;
  const a = JSON.parse<u32[]>("[100000000]", existing);
  expect(a.length).toBe(1);
  expect(a[0]).toBe(100000000);
});

describe("SIMD: i32[] reuse path with 9-digit value covers reuse signed SIMD loop (lines 434-435)", () => {
  const existing = new Array<i32>(3);
  existing[0] = 0;
  existing[1] = 0;
  existing[2] = 0;
  const a = JSON.parse<i32[]>("[100000000]", existing);
  expect(a.length).toBe(1);
  expect(a[0]).toBe(100000000);
});

// swar/array/integer.ts: deserializeIntegerArrayBody unsigned path
describe("SWAR: UintVec struct field covers unsigned path in deserializeIntegerArrayBody", () => {
  const v = JSON.parse<UintVec>('{"values":[1,2,3]}');
  expect(v.values.length).toBe(3);
  expect(v.values[0]).toBe(1);
});

describe("SWAR: UintVec struct field reparse with fewer elements covers body shrink path", () => {
  const v1 = JSON.parse<UintVec>('{"values":[1,2,3]}');
  expect(v1.values.length).toBe(3);
  const v2 = JSON.parse<UintVec>('{"values":[4,5]}', v1);
  expect(v2.values.length).toBe(2);
  expect(v2.values[0]).toBe(4);
});
