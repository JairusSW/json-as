import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class StrictChild {
  id: i32 = 0;
}


@json
class StrictStruct {
  name: string = "";
  child: StrictChild = new StrictChild();
  values: i32[] = [];
  lookup: Map<string, i32> = new Map<string, i32>();
}


@json({ lazy: "all" })
class StrictLazyStruct {
  name: string = "";
  child: JSON.Lazy<StrictChild> = new StrictChild();
  values: JSON.Lazy<i32[]> = [];
  lookup: JSON.Lazy<Map<string, i32>> = new Map<string, i32>();
  dynamic: JSON.Lazy<JSON.Obj> = new JSON.Obj();
}

describe("strict mode accepts every parse target family", () => {
  const struct = JSON.parse<StrictStruct>(
    '{"name":"typed","child":{"id":7},"values":[1,2],"lookup":{"a":3}}',
  );
  expect(struct.name).toBe("typed");
  expect(struct.child.id).toBe(7);
  expect(struct.values[1]).toBe(2);
  expect(struct.lookup.get("a")).toBe(3);

  const lazy = JSON.parse<StrictLazyStruct>(
    '{"name":"lazy","child":{"id":8},"values":[4,5],"lookup":{"b":6},"dynamic":{"ok":true}}',
  );
  expect(lazy.name).toBe("lazy");
  expect(lazy.child.id).toBe(8);
  expect(lazy.values[1]).toBe(5);
  expect(lazy.lookup.get("b")).toBe(6);
  expect(lazy.dynamic.getAs<bool>("ok")).toBe(true);

  const obj = JSON.parse<JSON.Obj>('{"n":1,"nested":{"ok":true}}');
  expect(obj.getAs<f64>("n")).toBe(1.0);
  expect(obj.getAs<JSON.Obj>("nested").getAs<bool>("ok")).toBe(true);

  const arr = JSON.parse<JSON.Arr>('[1,{"ok":true}]');
  expect(arr.at(0).get<f64>()).toBe(1.0);
  expect(arr.at(1).get<JSON.Obj>().getAs<bool>("ok")).toBe(true);

  const value = JSON.parse<JSON.Value>('{"items":[1,2]}');
  expect(value.get<JSON.Obj>().getAs<JSON.Arr>("items").at(1).get<f64>()).toBe(
    2.0,
  );
  expect(JSON.parse<JSON.Raw>('{"raw":[1,true]}').toString()).toBe(
    '{"raw":[1,true]}',
  );

  const map = JSON.parse<Map<string, StrictChild>>('{"first":{"id":9}}');
  expect(map.get("first")!.id).toBe(9);
  expect(JSON.parse<i32[]>("[1,2,3]")[2]).toBe(3);
  expect(JSON.parse<StaticArray<i32>>("[4,5]")[1]).toBe(5);
  expect(JSON.parse<Set<i32>>("[6,7]").has(7)).toBe(true);
  expect(JSON.parse<Int32Array>("[8,9]")[1]).toBe(9);
  expect(JSON.parse<ArrayBuffer>("[10,11]").byteLength).toBe(2);
  expect(JSON.parse<Date>('"1970-01-01T00:00:00.000Z"').getTime()).toBe(0);

  expect(JSON.parse<i32>("42")).toBe(42);
  expect(JSON.parse<f64>("1.25")).toBe(1.25);
  expect(JSON.parse<bool>("true")).toBe(true);
  expect(JSON.parse<string>('"text"')).toBe("text");
});

describe("strict mode rejects malformed JSON for every target family", () => {
  expect((): void => {
    JSON.parse<StrictStruct>('{"name":"typed",}');
  }).toThrow();
  expect((): void => {
    JSON.parse<StrictLazyStruct>('{"values":[1,2,]}');
  }).toThrow();
  expect((): void => {
    JSON.parse<JSON.Obj>('{"n":1,}');
  }).toThrow();
  expect((): void => {
    JSON.parse<JSON.Arr>("[1,]");
  }).toThrow();
  expect((): void => {
    JSON.parse<JSON.Value>("01");
  }).toThrow();
  expect((): void => {
    JSON.parse<JSON.Raw>("true false");
  }).toThrow();
  expect((): void => {
    JSON.parse<Map<string, i32>>('{"a":1,}');
  }).toThrow();
  expect((): void => {
    JSON.parse<i32[]>("[1 2]");
  }).toThrow();
  expect((): void => {
    JSON.parse<StaticArray<i32>>("[1,2,]");
  }).toThrow();
  expect((): void => {
    JSON.parse<Set<i32>>("[1;2]");
  }).toThrow();
  expect((): void => {
    JSON.parse<Int32Array>("[1,2,]");
  }).toThrow();
  expect((): void => {
    JSON.parse<ArrayBuffer>("[1,2,]");
  }).toThrow();
  expect((): void => {
    JSON.parse<Date>('"1970-01-01T00:00:00.000Z" trailing');
  }).toThrow();
  expect((): void => {
    JSON.parse<i32>("+1");
  }).toThrow();
  expect((): void => {
    JSON.parse<f64>("NaN");
  }).toThrow();
  expect((): void => {
    JSON.parse<bool>("True");
  }).toThrow();
  expect((): void => {
    JSON.parse<string>('"unterminated');
  }).toThrow();
});
