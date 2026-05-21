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
  // — same shape, different stride implementation.

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
