import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Should serialize integer static arrays", () => {
  expect(JSON.stringify<StaticArray<u32>>([0, 100, 101])).toBe("[0,100,101]");

  expect(JSON.stringify<StaticArray<u64>>([0, 100, 101])).toBe("[0,100,101]");

  expect(JSON.stringify<StaticArray<i32>>([0, 100, 101, -100, -101])).toBe("[0,100,101,-100,-101]");

  expect(JSON.stringify<StaticArray<i64>>([0, 100, 101, -100, -101])).toBe("[0,100,101,-100,-101]");
});

describe("Should serialize float static arrays", () => {
  expect(JSON.stringify<StaticArray<f64>>([7.23, 1000.0, 0.0])).toBe("[7.23,1000.0,0.0]");
});

describe("Should serialize boolean static arrays", () => {
  expect(JSON.stringify<StaticArray<bool>>([true, false])).toBe("[true,false]");
});

describe("Should serialize string static arrays", () => {
  expect(JSON.stringify<StaticArray<string>>(["hello", "world"])).toBe('["hello","world"]');
});

describe("Should serialize empty static arrays", () => {
  const empty: StaticArray<i32> = [];
  expect(JSON.stringify(empty)).toBe("[]");
});

describe("Should deserialize integer static arrays", () => {
  const arr1 = JSON.parse<StaticArray<u32>>("[0,100,101]");
  expect(arr1.length).toBe(3);
  expect(arr1[0]).toBe(0);
  expect(arr1[1]).toBe(100);
  expect(arr1[2]).toBe(101);

  const arr2 = JSON.parse<StaticArray<i32>>("[0,100,-100]");
  expect(arr2.length).toBe(3);
  expect(arr2[0]).toBe(0);
  expect(arr2[1]).toBe(100);
  expect(arr2[2]).toBe(-100);
});

describe("Should deserialize float static arrays", () => {
  const arr = JSON.parse<StaticArray<f64>>("[7.23,1000.0,0.0]");
  expect(arr.length).toBe(3);
  expect(arr[0]).toBe(7.23);
  expect(arr[1]).toBe(1000.0);
  expect(arr[2]).toBe(0.0);
});

describe("Should deserialize boolean static arrays", () => {
  const arr = JSON.parse<StaticArray<bool>>("[true,false]");
  expect(arr.length).toBe(2);
  expect(arr[0]).toBe(true);
  expect(arr[1]).toBe(false);
});

describe("Should deserialize string static arrays", () => {
  const arr = JSON.parse<StaticArray<string>>('["hello","world"]');
  expect(arr.length).toBe(2);
  expect(arr[0]).toBe("hello");
  expect(arr[1]).toBe("world");
});

describe("Should deserialize empty static arrays", () => {
  const arr = JSON.parse<StaticArray<i32>>("[]");
  expect(arr.length).toBe(0);
});

describe("Should round-trip static arrays", () => {
  const original: StaticArray<i32> = [1, 2, 3, 4, 5];
  const serialized = JSON.stringify(original);
  expect(serialized).toBe("[1,2,3,4,5]");
  const deserialized = JSON.parse<StaticArray<i32>>(serialized);
  expect(deserialized.length).toBe(5);
  expect(deserialized[0]).toBe(1);
  expect(deserialized[4]).toBe(5);
});

describe("Should serialize nested static arrays", () => {
  const nested: StaticArray<StaticArray<i32>> = [
    [1, 2],
    [3, 4],
  ];
  expect(JSON.stringify(nested)).toBe("[[1,2],[3,4]]");
});

describe("Should deserialize nested static arrays", () => {
  const arr = JSON.parse<StaticArray<StaticArray<i32>>>("[[1,2],[3,4]]");
  expect(arr.length).toBe(2);
  expect(arr[0].length).toBe(2);
  expect(arr[0][0]).toBe(1);
  expect(arr[0][1]).toBe(2);
  expect(arr[1][0]).toBe(3);
  expect(arr[1][1]).toBe(4);
});

describe("Should serialize object static arrays", () => {
  const arr: StaticArray<Vec3> = [
    { x: 1.0, y: 2.0, z: 3.0 },
    { x: 4.0, y: 5.0, z: 6.0 },
  ];
  expect(JSON.stringify(arr)).toBe('[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]');
});

describe("Should deserialize object static arrays", () => {
  const arr = JSON.parse<StaticArray<Vec3>>('[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]');
  expect(arr.length).toBe(2);
  expect(arr[0].x).toBe(1.0);
  expect(arr[0].y).toBe(2.0);
  expect(arr[0].z).toBe(3.0);
  expect(arr[1].x).toBe(4.0);
  expect(arr[1].y).toBe(5.0);
  expect(arr[1].z).toBe(6.0);
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

describe("Should support additional staticarray boundaries", () => {
  const arr = JSON.parse<StaticArray<i32>>("[-1,0,1,2,3]");
  expect(arr.length).toBe(5);
  expect(arr[0]).toBe(-1);
  expect(arr[4]).toBe(3);
});

describe("Should round-trip nested empty static arrays", () => {
  const arr: StaticArray<StaticArray<i32>> = [[], [1], []];
  const out = JSON.stringify(arr);
  expect(out).toBe("[[],[1],[]]");
  expect(JSON.stringify(JSON.parse<StaticArray<StaticArray<i32>>>(out))).toBe("[[],[1],[]]");
});

describe("Should support whitespace and negative values in static arrays", () => {
  const arr = JSON.parse<StaticArray<i32>>("[ -5 , 0 , 5 ]");
  expect(arr.length).toBe(3);
  expect(arr[0]).toBe(-5);
  expect(arr[1]).toBe(0);
  expect(arr[2]).toBe(5);
});

describe("Should round-trip static array objects with reordered fields", () => {
  const arr = JSON.parse<StaticArray<Vec3>>('[{"z":3.0,"y":2.0,"x":1.0},{"y":5.0,"x":4.0,"z":6.0}]');
  expect(arr.length).toBe(2);
  expect(arr[0].x).toBe(1.0);
  expect(arr[0].y).toBe(2.0);
  expect(arr[0].z).toBe(3.0);
  expect(arr[1].x).toBe(4.0);
  expect(arr[1].y).toBe(5.0);
  expect(arr[1].z).toBe(6.0);
  expect(JSON.stringify(arr)).toBe('[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]');
});

describe("Should deserialize static arrays of JSON.Value", () => {
  const arr = JSON.parse<StaticArray<JSON.Value>>('[{"a":1},"x",false,null,[1,2]]');
  expect(arr.length).toBe(5);
  expect(arr[0].get<JSON.Obj>().get("a")!.toString()).toBe("1.0");
  expect(arr[1].get<string>()).toBe("x");
  expect(arr[2].get<bool>().toString()).toBe("false");
  expect(arr[3].type.toString()).toBe(JSON.Types.Null.toString());
  expect(JSON.stringify(arr[4].get<JSON.Value[]>())).toBe("[1.0,2.0]");
  expect(JSON.stringify(arr)).toBe('[{"a":1.0},"x",false,null,[1.0,2.0]]');
});

describe("Should deserialize static arrays of maps and boxed values", () => {
  const maps = JSON.parse<StaticArray<Map<string, i32>>>('[{"a":1},{"b":2,"c":3}]');
  const boxed = JSON.parse<StaticArray<JSON.Box<i32>>>("[1,-2,3]");

  expect(maps.length).toBe(2);
  expect(maps[0].get("a")).toBe(1);
  expect(maps[1].get("b")).toBe(2);
  expect(maps[1].get("c")).toBe(3);
  expect(JSON.stringify(maps)).toBe('[{"a":1},{"b":2,"c":3}]');

  expect(boxed.length).toBe(3);
  expect(boxed[0].value).toBe(1);
  expect(boxed[1].value).toBe(-2);
  expect(boxed[2].value).toBe(3);
  expect(JSON.stringify(boxed)).toBe("[1,-2,3]");
});

describe("Should preserve escaped nested strings inside static arrays", () => {
  const strings = JSON.parse<StaticArray<string>>('["path \\\\\\\\ and quote \\\\\\"","brackets [ ] { }"]');
  const raw = JSON.parse<StaticArray<JSON.Raw>>('["text with spaces","{\\"nested\\":[1,2,3]}"]');

  expect(strings.length).toBe(2);
  expect(strings[0]).toBe('path \\\\ and quote \\"');
  expect(strings[1]).toBe("brackets [ ] { }");
  expect(JSON.stringify(strings)).toBe('["path \\\\\\\\ and quote \\\\\\"","brackets [ ] { }"]');

  expect(raw.length).toBe(2);
  expect(raw[0].toString()).toBe('"text with spaces"');
  expect(raw[1].toString()).toBe('"{\\"nested\\":[1,2,3]}"');
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
