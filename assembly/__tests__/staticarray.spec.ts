import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize integer static arrays", () => {
  expect(JSON.stringify<StaticArray<u32>>([0, 100, 101])).toBe("[0,100,101]");

  expect(JSON.stringify<StaticArray<u64>>([0, 100, 101])).toBe("[0,100,101]");

  expect(JSON.stringify<StaticArray<i32>>([0, 100, 101, -100, -101])).toBe("[0,100,101,-100,-101]");

  expect(JSON.stringify<StaticArray<i64>>([0, 100, 101, -100, -101])).toBe("[0,100,101,-100,-101]");
});
