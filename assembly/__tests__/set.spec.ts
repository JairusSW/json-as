import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize integer sets", () => {
  const set1 = new Set<u32>();
  set1.add(0);
  set1.add(100);
  set1.add(101);
  expect(JSON.stringify(set1)).toBe("[0,100,101]");

  const set2 = new Set<i32>();
  set2.add(0);
  set2.add(100);
  set2.add(-100);
  expect(JSON.stringify(set2)).toBe("[0,100,-100]");
});

describe("Should serialize float sets", () => {
  const set1 = new Set<f64>();
  set1.add(7.23);
  set1.add(1000.0);
  set1.add(0.0);
  expect(JSON.stringify(set1)).toBe("[7.23,1000.0,0.0]");
});

describe("Should serialize boolean sets", () => {
  const set1 = new Set<bool>();
  set1.add(true);
  set1.add(false);
  expect(JSON.stringify(set1)).toBe("[true,false]");
});

describe("Should serialize string sets", () => {
  const set1 = new Set<string>();
  set1.add("hello");
  set1.add("world");
  expect(JSON.stringify(set1)).toBe('["hello","world"]');
});

describe("Should serialize empty sets", () => {
  const set1 = new Set<i32>();
  expect(JSON.stringify(set1)).toBe("[]");
});

describe("Should deserialize integer sets", () => {
  const set1 = JSON.parse<Set<u32>>("[0,100,101]");
  expect(set1.has(0)).toBe(true);
  expect(set1.has(100)).toBe(true);
  expect(set1.has(101)).toBe(true);
  expect(set1.size).toBe(3);

  const set2 = JSON.parse<Set<i32>>("[0,100,-100]");
  expect(set2.has(0)).toBe(true);
  expect(set2.has(100)).toBe(true);
  expect(set2.has(-100)).toBe(true);
  expect(set2.size).toBe(3);
});

describe("Should deserialize float sets", () => {
  const set1 = JSON.parse<Set<f64>>("[7.23,1000.0,0.0]");
  expect(set1.has(7.23)).toBe(true);
  expect(set1.has(1000.0)).toBe(true);
  expect(set1.has(0.0)).toBe(true);
  expect(set1.size).toBe(3);
});

describe("Should deserialize boolean sets", () => {
  const set1 = JSON.parse<Set<bool>>("[true,false]");
  expect(set1.has(true)).toBe(true);
  expect(set1.has(false)).toBe(true);
  expect(set1.size).toBe(2);
});

describe("Should deserialize string sets", () => {
  const set1 = JSON.parse<Set<string>>('["hello","world"]');
  expect(set1.has("hello")).toBe(true);
  expect(set1.has("world")).toBe(true);
  expect(set1.size).toBe(2);
});

describe("Should deserialize empty sets", () => {
  const set1 = JSON.parse<Set<i32>>("[]");
  expect(set1.size).toBe(0);
});

describe("Should round-trip sets", () => {
  const set1 = new Set<i32>();
  set1.add(1);
  set1.add(2);
  set1.add(3);
  const serialized = JSON.stringify(set1);
  const deserialized = JSON.parse<Set<i32>>(serialized);
  expect(deserialized.has(1)).toBe(true);
  expect(deserialized.has(2)).toBe(true);
  expect(deserialized.has(3)).toBe(true);
  expect(deserialized.size).toBe(3);
});

describe("Should serialize object sets", () => {
  const set1 = new Set<Vec3>();
  set1.add({ x: 1.0, y: 2.0, z: 3.0 });
  set1.add({ x: 4.0, y: 5.0, z: 6.0 });
  const result = JSON.stringify(set1);
  expect(result).toBe('[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]');
});

@json
class Vec3 {
  x: f64 = 0.0;
  y: f64 = 0.0;
  z: f64 = 0.0;
}
