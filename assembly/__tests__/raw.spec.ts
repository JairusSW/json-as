import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize JSON.Raw", () => {
  expect(JSON.stringify<JSON.Raw>(JSON.Raw.from('{"x":1.0,"y":2.0,"z":3.0}'))).toBe('{"x":1.0,"y":2.0,"z":3.0}');
});

describe("Should deserialize JSON.Raw", () => {
  expect(JSON.parse<JSON.Raw>('{"x":1.0,"y":2.0,"z":3.0}').toString()).toBe('{"x":1.0,"y":2.0,"z":3.0}');
});

describe("Should serialize Map<string, JSON.Raw>", () => {
  const m1 = new Map<string, JSON.Raw>();
  m1.set("hello", new JSON.Raw('"world"'));
  m1.set("pos", new JSON.Raw('{"x":1.0,"y":2.0,"z":3.0}'));

  expect(JSON.stringify(m1)).toBe('{"hello":"world","pos":{"x":1.0,"y":2.0,"z":3.0}}');
});

describe("Should deserialize Map<string, JSON.Raw>", () => {
  const m1 = JSON.parse<Map<string, JSON.Raw>>('{"hello":"world","pos":{"x":1.0,"y":2.0,"z":3.0}}');
  expect(JSON.stringify(m1)).toBe('{"hello":"world","pos":{"x":1.0,"y":2.0,"z":3.0}}');
});
