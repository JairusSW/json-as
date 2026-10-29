import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class ReviewCollections {
  maps: Map<string, i32>[] = [];
  boxes: JSON.Box<i32>[] = [];
  sets: Set<i32>[] = [];
  values: JSON.Value[] = [];
  raw: JSON.Raw[] = [];
  dates: Date[] = [];
  ints: StaticArray<i32> = [];
  floats: StaticArray<f64> = [];
  flags: StaticArray<bool> = [];
  names: StaticArray<string> = [];
}

describe("Review: public output reuse", () => {
  const set = new Set<i32>();
  set.add(99);
  const parsedSet = JSON.parse<Set<i32>>("[1,2]", set);
  expect(parsedSet === set).toBe(true);
  expect(set.has(99)).toBe(false);
  expect(set.size).toBe(2);
  const fixed: StaticArray<i32> = [9, 9];
  expect(JSON.parse<StaticArray<i32>>("[1,2]", fixed) === fixed).toBe(true);
  expect(fixed[0]).toBe(1);
  const typed = new Int32Array(2);
  typed[0] = 99;
  expect(JSON.parse<Int32Array>("[1,2]", typed) === typed).toBe(true);
  expect(typed[0]).toBe(1);
  const buffer = new ArrayBuffer(2);
  expect(JSON.parse<ArrayBuffer>("[1,2]", buffer) === buffer).toBe(true);
  expect(load<u8>(changetype<usize>(buffer))).toBe(1);
  const box = new JSON.Box<i32>(99);
  expect(JSON.parse<JSON.Box<i32>>("7", box) === box).toBe(true);
  expect(box.value).toBe(7);
  const raw = new JSON.Raw("99");
  expect(JSON.parse<JSON.Raw>("[1,2]", raw) === raw).toBe(true);
  expect(raw.data).toBe("[1,2]");
});

describe("Review: bounded internal output reuse", () => {
  const source = '[1,"two"]';
  const start = changetype<usize>(source);
  const end = start + ((<usize>source.length) << 1);
  const array = new JSON.Arr();
  array.push(99);
  expect(
    JSON.__deserialize<JSON.Arr>(start, end, changetype<usize>(array)) ===
      array,
  ).toBe(true);
  expect(JSON.stringify(array)).toBe(source);
  const value = JSON.Value.from<i32>(99);
  expect(
    JSON.__deserialize<JSON.Value>(start, end, changetype<usize>(value)) ===
      value,
  ).toBe(true);
  expect(JSON.stringify(value)).toBe(source);
  const text = '{"key":1}';
  const ptr = changetype<usize>(text);
  const object = new JSON.Obj();
  object.set("stale", 99);
  expect(
    JSON.__deserialize<JSON.Obj>(
      ptr,
      ptr + ((<usize>text.length) << 1),
      changetype<usize>(object),
    ) === object,
  ).toBe(true);
  expect(object.has("stale")).toBe(false);
  expect(object.getAs<f64>("key")).toBe(1);
});

describe("Review: Raw reuse protects static literal storage", () => {
  const shared = "99";
  const out = new JSON.Raw(shared);
  expect(JSON.parse<JSON.Raw>("42", out) === out).toBe(true);
  expect(shared.charCodeAt(0)).toBe(57);
  expect(shared.charCodeAt(1)).toBe(57);
  expect(out.data).toBe("42");
  const empty = new JSON.Raw("");
  JSON.parse<JSON.Raw>("[1,2,3,4,5,6,7,8]", empty);
  expect(empty.data).toBe("[1,2,3,4,5,6,7,8]");
  expect("".length).toBe(0);
});

describe("Review: reference-array replacement and nullable elements", () => {
  const maps = JSON.parse<Map<string, i32>[]>('[{"old":9}]');
  JSON.parse<Map<string, i32>[]>('[{"new":1}]', maps);
  expect(maps.length).toBe(1);
  expect(maps[0].has("new")).toBe(true);
  const objects = JSON.parse<JSON.Obj[]>('[{"old":9}]');
  JSON.parse<JSON.Obj[]>('[{"new":1}]', objects);
  expect(objects.length).toBe(1);
  expect(objects[0].has("new")).toBe(true);
  const boxes = JSON.parse<JSON.Box<i32>[]>("[9]");
  JSON.parse<JSON.Box<i32>[]>("[1]", boxes);
  expect(boxes.length).toBe(1);
  expect(boxes[0].value).toBe(1);
  expect(JSON.stringify(JSON.parse<JSON.Box<bool>[]>("[true,false]"))).toBe(
    "[true,false]",
  );
  expect(
    JSON.stringify(
      JSON.parse<(Map<string, i32> | null)[]>('[null,{"a":1},null]'),
    ),
  ).toBe('[null,{"a":1},null]');
  expect(
    JSON.stringify(JSON.parse<(JSON.Obj | null)[]>('[null,{"a":1},null]')),
  ).toBe('[null,{"a":1},null]');
  expect(
    JSON.stringify(JSON.parse<(JSON.Box<i32> | null)[]>("[null,1,null]")),
  ).toBe("[null,1,null]");
  expect(
    JSON.stringify(JSON.parse<StaticArray<string | null>>('["a",null,"b"]')),
  ).toBe('["a",null,"b"]');
  const values = JSON.parse<JSON.Value[]>("[9]");
  JSON.parse<JSON.Value[]>("[1]", values);
  expect(JSON.stringify(values)).toBe("[1]");
  const raw = JSON.parse<JSON.Raw[]>("[9]");
  JSON.parse<JSON.Raw[]>("[1]", raw);
  expect(JSON.stringify(raw)).toBe("[1]");
  const nullableRaw = JSON.parse<(JSON.Raw | null)[]>("[null,1]");
  expect(nullableRaw.length).toBe(2);
  expect(nullableRaw[0] === null).toBe(true);
});

describe("Review: static output grows and shrinks across GC", () => {
  let ints: StaticArray<i32> = [];
  let floats: StaticArray<f64> = [];
  let flags: StaticArray<bool> = [];
  let names: StaticArray<string | null> = [];
  const lengths: i32[] = [0, 1, 17, 2, 0, 33, 1];
  for (let i = 0; i < lengths.length; i++) {
    const n = lengths[i];
    const a = new Array<i32>(n).fill(7);
    const b = new Array<f64>(n).fill(1.5);
    const c = new Array<bool>(n).fill(true);
    const d = new Array<string | null>(n).fill(i % 2 == 0 ? null : "value");
    ints = JSON.parse<StaticArray<i32>>(JSON.stringify(a), ints);
    floats = JSON.parse<StaticArray<f64>>(JSON.stringify(b), floats);
    flags = JSON.parse<StaticArray<bool>>(JSON.stringify(c), flags);
    names = JSON.parse<StaticArray<string | null>>(JSON.stringify(d), names);
    __collect();
    expect(JSON.stringify(ints)).toBe(JSON.stringify(a));
    expect(JSON.stringify(floats)).toBe(JSON.stringify(b));
    expect(JSON.stringify(flags)).toBe(JSON.stringify(c));
    expect(JSON.stringify(names)).toBe(JSON.stringify(d));
  }
});

describe("Review: empty generated arrays and shrinking static fields", () => {
  const out = JSON.parse<ReviewCollections>(
    '{"maps":[{"a":1}],"boxes":[1],"sets":[[1]],"values":[1],"raw":[1],"dates":["2025-01-01T00:00:00.000Z"],"ints":[1,2,3],"floats":[1.5,2.5],"flags":[true,false],"names":["a","b"]}',
  );
  JSON.parse<ReviewCollections>(
    '{"maps":[],"boxes":[],"sets":[],"values":[],"raw":[],"dates":[],"ints":[4],"floats":[3.5],"flags":[false],"names":["c"]}',
    out,
  );
  expect(out.maps.length).toBe(0);
  expect(out.boxes.length).toBe(0);
  expect(out.sets.length).toBe(0);
  expect(out.values.length).toBe(0);
  expect(out.raw.length).toBe(0);
  expect(out.dates.length).toBe(0);
  expect(out.ints.length).toBe(1);
  expect(out.floats.length).toBe(1);
  expect(out.flags.length).toBe(1);
  expect(out.names.length).toBe(1);
});
