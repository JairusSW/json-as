import { JSON } from "..";
import { describe, expect } from "as-test";

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

  const set2 = new Set<f32>();
  set2.add(-1.5);
  set2.add(0.25);
  set2.add(3.75);
  expect(JSON.stringify(set2)).toBe("[-1.5,0.25,3.75]");
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

  const set2 = JSON.parse<Set<f32>>("[-1.5,0.25,3.75]");
  expect(set2.has(-1.5)).toBe(true);
  expect(set2.has(0.25)).toBe(true);
  expect(set2.has(3.75)).toBe(true);
  expect(set2.size).toBe(3);
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

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should deduplicate repeated set values", () => {
  const set1 = JSON.parse<Set<i32>>("[1,1,2,2,3,3]");
  expect(set1.size).toBe(3);
  expect(set1.has(1)).toBe(true);
  expect(set1.has(2)).toBe(true);
  expect(set1.has(3)).toBe(true);
});

describe("Should deserialize and reserialize string sets", () => {
  const set1 = JSON.parse<Set<string>>('["a","b","a"]');
  expect(set1.size).toBe(2);
  expect(JSON.stringify(set1)).toBe('["a","b"]');
});

describe("Should round-trip sets with whitespace and nested values", () => {
  const ints = JSON.parse<Set<i32>>("[ 4 , 5 , 5 , 6 ]");
  expect(ints.size).toBe(3);
  expect(ints.has(4)).toBe(true);
  expect(ints.has(5)).toBe(true);
  expect(ints.has(6)).toBe(true);

  const bools = JSON.parse<Set<bool>>("[ true , false , true , false ]");
  expect(bools.size).toBe(2);
  expect(JSON.stringify(bools)).toBe("[true,false]");
});

describe("Should round-trip object sets through serialization boundaries", () => {
  const set1 = new Set<Vec3>();
  const a = new Vec3();
  a.x = 1.0;
  a.y = 2.0;
  a.z = 3.0;
  const b = new Vec3();
  b.x = -4.0;
  b.y = 5.5;
  b.z = 6.0;
  set1.add(a);
  set1.add(b);
  const out = JSON.stringify(set1);
  expect(out).toBe('[{"x":1.0,"y":2.0,"z":3.0},{"x":-4.0,"y":5.5,"z":6.0}]');
});

describe("Should serialize single-item sets without trailing commas", () => {
  const ints = new Set<i32>();
  ints.add(42);
  expect(JSON.stringify(ints)).toBe("[42]");

  const floats = new Set<f32>();
  floats.add(-0.5);
  expect(JSON.stringify(floats)).toBe("[-0.5]");

  const bools = new Set<bool>();
  bools.add(true);
  expect(JSON.stringify(bools)).toBe("[true]");

  const strings = new Set<string>();
  strings.add("x");
  expect(JSON.stringify(strings)).toBe('["x"]');
});

describe("Should preserve JSON.internal behavior for primitive sets", () => {
  const intSet = new Set<i32>();
  intSet.add(1);
  intSet.add(2);
  intSet.add(3);

  const floatSet = new Set<f32>();
  floatSet.add(-1.5);
  floatSet.add(0.25);
  floatSet.add(3.75);

  const boolSet = new Set<bool>();
  boolSet.add(true);
  boolSet.add(false);

  const stringSet = new Set<string>();
  stringSet.add("alpha");
  stringSet.add("beta");

  const ints = JSON.internal.stringify(intSet);
  const floats = JSON.internal.stringify(floatSet);
  const bools = JSON.internal.stringify(boolSet);
  const strings = JSON.internal.stringify(stringSet);

  expect(ints).toBe("[1,2,3]");
  expect(floats).toBe("[-1.5,0.25,3.75]");
  expect(bools).toBe("[true,false]");
  expect(strings).toBe('["alpha","beta"]');

  const parsedInts = JSON.internal.parse<Set<i32>>(ints);
  const parsedFloats = JSON.internal.parse<Set<f32>>(floats);
  const parsedBools = JSON.internal.parse<Set<bool>>(bools);
  const parsedStrings = JSON.internal.parse<Set<string>>(strings);

  expect(parsedInts.size).toBe(3);
  expect(parsedFloats.has(-1.5)).toBe(true);
  expect(parsedBools.has(false)).toBe(true);
  expect(parsedStrings.has("beta")).toBe(true);
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
