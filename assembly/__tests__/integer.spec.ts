import { JSON } from "..";
import { describe, expect } from "./lib";

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
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
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

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
