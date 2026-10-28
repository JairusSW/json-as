import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Review: typed-array reuse preserves offset views and sibling bytes", () => {
  const backing = new Int32Array(6);
  backing.fill(99);
  const view = Int32Array.wrap(backing.buffer, 8, 2);
  const result = JSON.parse<Int32Array>("[1,2]", view);
  expect(result === view).toBe(true);
  expect(result.buffer === backing.buffer).toBe(true);
  expect(result.dataStart === view.dataStart).toBe(true);
  expect(backing[0]).toBe(99);
  expect(backing[1]).toBe(99);
  expect(backing[2]).toBe(1);
  expect(backing[3]).toBe(2);
  expect(backing[4]).toBe(99);
  expect(backing[5]).toBe(99);
  const shorter = JSON.parse<Int32Array>("[4]", view);
  expect(shorter.length).toBe(1);
  expect(shorter[0]).toBe(4);
  expect(view.length).toBe(2);
  expect(backing.length).toBe(6);
  const longer = JSON.parse<Int32Array>("[5,6,7,8]", view);
  expect(longer.length).toBe(4);
  expect(longer[3]).toBe(8);
  expect(backing[5]).toBe(99);
});

describe("Review: clamped typed arrays clamp instead of wrapping", () => {
  const result = JSON.parse<Uint8ClampedArray>("[-1,0,255,256,1000]");
  expect(JSON.stringify(result)).toBe("[0,0,255,255,255]");
});
