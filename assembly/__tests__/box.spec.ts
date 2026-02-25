import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Should serialize JSON.Box<T>", () => {
  expect(JSON.stringify<JSON.Box<i32> | null>(null)).toBe("null");

  expect(JSON.stringify<JSON.Box<i32> | null>(new JSON.Box<i32>(0))).toBe("0");

  expect(JSON.stringify<JSON.Box<i32> | null>(new JSON.Box<i32>(1))).toBe("1");

  expect(JSON.stringify<JSON.Box<boolean> | null>(new JSON.Box<boolean>(false))).toBe("false");

  expect(JSON.stringify<JSON.Box<boolean> | null>(new JSON.Box<boolean>(true))).toBe("true");
});

// This is somewhat clumsy to use. Perhaps I can redesign it or use some transform to make it more transparent.
describe("Should deserialize JSON.Box<T>", () => {
  expect((JSON.parse<JSON.Box<i32> | null>("null") == null).toString()).toBe("true");

  expect(JSON.parse<JSON.Box<i32> | null>("0")!.value.toString()).toBe("0");

  expect(JSON.parse<JSON.Box<i32> | null>("1")!.value.toString()).toBe("1");

  expect(JSON.parse<JSON.Box<boolean> | null>("false")!.value.toString()).toBe("false");

  expect(JSON.parse<JSON.Box<boolean> | null>("true")!.value.toString()).toBe("true");
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should support JSON.Box.from helpers", () => {
  const boxedA = JSON.Box.from<i32>(99);
  expect(JSON.stringify(boxedA)).toBe("99");

  const boxedB = JSON.Box.from<boolean>(false);
  expect(JSON.stringify(boxedB)).toBe("false");
});

describe("Should deserialize additional JSON.Box values", () => {
  expect(JSON.parse<JSON.Box<i64> | null>("9223372036854775807")!.value.toString()).toBe("9223372036854775807");
  expect(JSON.parse<JSON.Box<boolean> | null>("true")!.value.toString()).toBe("true");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
