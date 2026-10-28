import { JSON } from "..";
import { describe, expect } from "as-test";

function deserializeSlice<T>(source: string): T {
  const start = changetype<usize>(source);
  return JSON.__deserialize<T>(start, start + (source.length << 1));
}

function expectNumberWhitespace<T extends number>(
  literal: string,
  expected: T,
): void {
  const whitespace = ["", " ", "\t", "\n", "\r", " \t\r\n"];
  for (let i = 0; i < whitespace.length; i++) {
    for (let j = 0; j < whitespace.length; j++) {
      const source = whitespace[i] + literal + whitespace[j];
      expect(JSON.parse<T>(source).toString()).toBe(expected.toString());
      expect(deserializeSlice<T>(source).toString()).toBe(expected.toString());
      expect(JSON.parse<JSON.Box<T>>(source).value.toString()).toBe(
        expected.toString(),
      );
      expect(JSON.parse<JSON.Box<T> | null>(source)!.value.toString()).toBe(
        expected.toString(),
      );
      expect(deserializeSlice<JSON.Box<T>>(source).value.toString()).toBe(
        expected.toString(),
      );
      expect(
        deserializeSlice<JSON.Box<T> | null>(source)!.value.toString(),
      ).toBe(expected.toString());
    }
  }
}

describe("integer roots and boxes accept surrounding JSON whitespace", () => {
  expectNumberWhitespace<i8>("-128", -128);
  expectNumberWhitespace<u8>("255", 255);
  expectNumberWhitespace<i16>("-32768", -32768);
  expectNumberWhitespace<u16>("65535", 65535);
  expectNumberWhitespace<i32>("-2147483648", -2147483648);
  expectNumberWhitespace<i32>("2147483647", 2147483647);
  expectNumberWhitespace<u32>("4294967295", 4294967295);
  expectNumberWhitespace<i64>("-9223372036854775808", -9223372036854775808);
  expectNumberWhitespace<i64>("9223372036854775807", 9223372036854775807);
  expectNumberWhitespace<u64>("18446744073709551615", 18446744073709551615);
  expectNumberWhitespace<isize>("-7", -7);
  expectNumberWhitespace<usize>("7", 7);
  expectNumberWhitespace<i32>("0", 0);
  expectNumberWhitespace<i32>("-0", 0);
  expectNumberWhitespace<u32>("0", 0);
});

describe("integer whitespace handling leaves float parsing unchanged", () => {
  expectNumberWhitespace<f32>("-1.25", -1.25);
  expectNumberWhitespace<f64>("1.25e3", 1250.0);
});

describe("integer slice trimming respects the supplied source bounds", () => {
  const source = "ignored \t-42\r\nignored";
  const start = changetype<usize>(source) + (8 << 1);
  const end = start + (6 << 1);
  expect(JSON.__deserialize<i32>(start, end)).toBe(-42);
  expect(JSON.__deserialize<JSON.Box<i32>>(start, end).value).toBe(-42);
});


@json
class IntegerWhitespaceFields {
  signed: i32 = 0;
  unsigned: u32 = 0;
  boxed: JSON.Box<i32> = new JSON.Box<i32>(0);
}

describe("integer fields and arrays retain their whitespace behavior", () => {
  const data = JSON.parse<IntegerWhitespaceFields>(
    ' \t{ "signed": -7 , "unsigned": 8 , "boxed": 9 }\r\n',
  );
  expect(data.signed).toBe(-7);
  expect(data.unsigned).toBe(8);
  expect(data.boxed.value).toBe(9);
  expect(JSON.stringify(JSON.parse<i32[]>(" \t[ -7 , 0 , 8 ]\r\n"))).toBe(
    "[-7,0,8]",
  );
  expect(
    JSON.stringify(JSON.parse<JSON.Box<i32>[]>(" \t[ -7 , 0 , 8 ]\r\n")),
  ).toBe("[-7,0,8]");
});

describe("integer trimming preserves Raw suffixes and other scalar targets", () => {
  const source = " \t7\r\n";
  expect(JSON.parse<JSON.Raw>(source).data).toBe("7\r\n");
  expect(deserializeSlice<JSON.Raw>(source).data).toBe("7\r\n");
  expect(JSON.parse<string>(' \t"7 "\r\n')).toBe("7 ");
  expect(JSON.parse<bool>(" \ttrue\r\n")).toBe(true);
  expect(JSON.parse<JSON.Box<bool>>(" \tfalse\r\n").value).toBe(false);
  expect(JSON.parse<JSON.Box<i32> | null>("null") == null).toBe(true);
});

let malformedNumber = "";

function expectStrictReject<T>(source: string): void {
  malformedNumber = source;
  expect((): void => {
    JSON.parse<T>(malformedNumber);
  }).toThrow();
}

if (JSON_STRICT) {
  describe("strict integer parsing still rejects malformed numeric tokens", () => {
    const malformed = [
      "",
      " \t\r\n",
      "- ",
      "01 ",
      "+7 ",
      "7 x",
      "7 8",
      "7\u00a0",
    ];
    for (let i = 0; i < malformed.length; i++) {
      expectStrictReject<i32>(malformed[i]);
      expectStrictReject<u32>(malformed[i]);
      expectStrictReject<JSON.Box<i32>>(malformed[i]);
      expectStrictReject<JSON.Box<u32> | null>(malformed[i]);
    }
  });
}
