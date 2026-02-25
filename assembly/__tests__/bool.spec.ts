import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Should serialize booleans", () => {
  expect(JSON.stringify<bool>(true)).toBe("true");
  expect(JSON.stringify<bool>(false)).toBe("false");
});

describe("Should deserialize booleans", () => {
  expect(JSON.parse<boolean>("true").toString()).toBe("true");
  expect(JSON.parse<boolean>("false").toString()).toBe("false");
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should round-trip boolean arrays and nested arrays", () => {
  expect(JSON.stringify(JSON.parse<bool[]>("[true,false,true,false]"))).toBe("[true,false,true,false]");
  expect(JSON.stringify(JSON.parse<bool[][]>("[[true],[false,true]]"))).toBe("[[true],[false,true]]");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
