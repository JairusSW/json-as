import { JSON } from "..";
import { describe, expect } from "./lib";

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
