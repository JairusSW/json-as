import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize JSON.Raw", () => {
  expect(
    JSON.stringify<JSON.Raw>(JSON.Raw.from('{"x":1.0,"y":2.0,"z":3.0}')),
  ).toBe('{"x":1.0,"y":2.0,"z":3.0}');
});

describe("Should deserialize JSON.Raw", () => {
  expect(JSON.parse<JSON.Raw>('{"x":1.0,"y":2.0,"z":3.0}').toString()).toBe(
    '{"x":1.0,"y":2.0,"z":3.0}',
  );
});

describe("Should serialize Map<string, JSON.Raw>", () => {
  const m1 = new Map<string, JSON.Raw>();
  m1.set("hello", new JSON.Raw('"world"'));
  m1.set("pos", new JSON.Raw('{"x":1.0,"y":2.0,"z":3.0}'));

  expect(JSON.stringify(m1)).toBe(
    '{"hello":"world","pos":{"x":1.0,"y":2.0,"z":3.0}}',
  );
});

describe("Should deserialize Map<string, JSON.Raw>", () => {
  const m1 = JSON.parse<Map<string, JSON.Raw>>(
    '{"hello":"world","pos":{"x":1.0,"y":2.0,"z":3.0}}',
  );
  expect(JSON.stringify(m1)).toBe(
    '{"hello":"world","pos":{"x":1.0,"y":2.0,"z":3.0}}',
  );
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

describe("Should handle additional JSON.Raw round trips", () => {
  const rawArray = JSON.parse<JSON.Raw[]>('[{"x":1},[1,2,3],"abc",false]');
  expect(rawArray[0].toString()).toBe('{"x":1}');
  expect(rawArray[1].toString()).toBe("[1,2,3]");
  expect(rawArray[2].toString()).toBe('"abc"');
  expect(rawArray[3].toString()).toBe("false");
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
