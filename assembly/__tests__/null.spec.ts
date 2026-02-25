import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Should serialize null", () => {
  expect(JSON.stringify(null)).toBe("null");
});

describe("Should serialize nullable classes", () => {
  expect(JSON.stringify<Nullable | null>(null)).toBe("null");
});

class Nullable {}

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should deserialize null values", () => {
  expect((JSON.parse<Nullable | null>("null") == null).toString()).toBe("true");
  expect((JSON.parse<JSON.Box<i32> | null>("null") == null).toString()).toBe("true");
});

describe("Should keep non-null values with nullable wrappers", () => {
  const boxed = JSON.parse<JSON.Box<i32> | null>("15");
  expect((boxed == null).toString()).toBe("false");
  expect(boxed!.value.toString()).toBe("15");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
