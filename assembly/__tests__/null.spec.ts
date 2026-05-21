import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class MaybeData {
  value: string | null = null;
  other: JSON.Box<i32> | null = null;
}

describe("Should serialize null", () => {
  expect(JSON.stringify(null)).toBe("null");
});

describe("Should serialize nullable classes", () => {
  expect(JSON.stringify<Nullable | null>(null)).toBe("null");
});

class Nullable {}

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

describe("Should deserialize null values", () => {
  expect((JSON.parse<Nullable | null>("null") == null).toString()).toBe("true");
  expect((JSON.parse<JSON.Box<i32> | null>("null") == null).toString()).toBe(
    "true",
  );
});

describe("Should keep non-null values with nullable wrappers", () => {
  const boxed = JSON.parse<JSON.Box<i32> | null>("15");
  expect((boxed == null).toString()).toBe("false");
  expect(boxed!.value.toString()).toBe("15");
});

describe("Should round-trip nulls inside arrays and objects", () => {
  const parsed = JSON.parse<MaybeData>('{"value":null,"other":12}');
  expect((parsed.value == null).toString()).toBe("true");
  expect((parsed.other == null).toString()).toBe("false");
  expect(parsed.other!.value.toString()).toBe("12");
  expect(JSON.stringify(parsed)).toBe('{"value":null,"other":12}');

  const parsedNulls = JSON.parse<MaybeData>('{"value":null,"other":null}');
  expect((parsedNulls.value == null).toString()).toBe("true");
  expect((parsedNulls.other == null).toString()).toBe("true");
  expect(JSON.stringify(parsedNulls)).toBe('{"value":null,"other":null}');
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

describe("Should round-trip standalone Box<T> | null for every primitive", () => {
  // i32
  expect(JSON.stringify<JSON.Box<i32> | null>(null)).toBe("null");
  expect(JSON.stringify<JSON.Box<i32> | null>(new JSON.Box<i32>(-7))).toBe(
    "-7",
  );
  expect((JSON.parse<JSON.Box<i32> | null>("null") == null).toString()).toBe(
    "true",
  );
  expect(JSON.parse<JSON.Box<i32> | null>("-7")!.value.toString()).toBe("-7");

  // u64
  expect(
    JSON.stringify<JSON.Box<u64> | null>(
      new JSON.Box<u64>(18446744073709551615),
    ),
  ).toBe("18446744073709551615");
  expect(
    JSON.parse<JSON.Box<u64> | null>("18446744073709551615")!.value.toString(),
  ).toBe("18446744073709551615");

  // f64
  expect(JSON.stringify<JSON.Box<f64> | null>(null)).toBe("null");
  expect(JSON.stringify<JSON.Box<f64> | null>(new JSON.Box<f64>(-0.125))).toBe(
    "-0.125",
  );
  expect(JSON.parse<JSON.Box<f64> | null>("-0.125")!.value.toString()).toBe(
    "-0.125",
  );

  // f32
  expect(JSON.stringify<JSON.Box<f32> | null>(new JSON.Box<f32>(0.25))).toBe(
    "0.25",
  );

  // bool
  expect(JSON.stringify<JSON.Box<bool> | null>(null)).toBe("null");
  expect(JSON.stringify<JSON.Box<bool> | null>(new JSON.Box<bool>(true))).toBe(
    "true",
  );
  expect(JSON.parse<JSON.Box<bool> | null>("false")!.value.toString()).toBe(
    "false",
  );
});

describe("Should round-trip standalone T | null for non-primitive types", () => {
  // string | null
  expect(JSON.stringify<string | null>(null)).toBe("null");
  expect(JSON.stringify<string | null>("hello")).toBe('"hello"');
  expect((JSON.parse<string | null>("null") == null).toString()).toBe("true");
  expect(JSON.parse<string | null>('"hello"')).toBe("hello");

  // @json class | null
  expect(JSON.stringify<NullableVec | null>(null)).toBe("null");
  expect(
    JSON.stringify<NullableVec | null>({ x: 1, y: 2 } as NullableVec),
  ).toBe('{"x":1,"y":2}');
  expect((JSON.parse<NullableVec | null>("null") == null).toString()).toBe(
    "true",
  );
  const parsedVec = JSON.parse<NullableVec | null>('{"x":3,"y":4}');
  expect((parsedVec == null).toString()).toBe("false");
  expect(parsedVec!.x.toString()).toBe("3");
  expect(parsedVec!.y.toString()).toBe("4");

  // Date | null
  expect(JSON.stringify<Date | null>(null)).toBe("null");
  expect((JSON.parse<Date | null>("null") == null).toString()).toBe("true");
});


@json
class NullableVec {
  x: i32 = 0;
  y: i32 = 0;
}
