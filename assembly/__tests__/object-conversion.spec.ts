import { JSON } from "..";
import { describe, expect } from "as-test";


@json class CustomMap extends Map<string, i32> {

  @serializer serialize(): string {
    return '{"wire":42}';
  }
}
describe("Map conversion preserves JSON semantics", () => {
  const strings = new Map<string, string[]>();
  strings.set("items", ["one", "two"]);
  expect(JSON.stringify(JSON.Obj.from(strings))).toBe(JSON.stringify(strings));
  const dates = new Map<string, Date>();
  dates.set("created", new Date(0));
  expect(JSON.stringify(JSON.Obj.from(dates))).toBe(JSON.stringify(dates));
  const custom = new CustomMap();
  custom.set("backing", 7);
  expect(JSON.stringify(JSON.Obj.from(custom))).toBe(JSON.stringify(custom));
});

describe("Map conversion preserves supported boxed scalar tags", () => {
  const values = new Map<string, JSON.Box<i32>>();
  values.set("n", new JSON.Box<i32>(7));
  const object = JSON.Obj.from(values);
  expect(object.getAs<i32>("n")).toBe(7);
});

describe("Map conversion preserves nullable and wide boxed scalars", () => {
  const nullable = new Map<string, JSON.Box<i32> | null>();
  nullable.set("n", null);
  nullable.set("i", new JSON.Box<i32>(9));
  const object = JSON.Obj.from(nullable);
  expect(JSON.stringify(object)).toBe('{"n":null,"i":9}');
  expect(object.getAs<i32>("i")).toBe(9);
  const wide = new Map<string, JSON.Box<i64>>();
  wide.set("n", new JSON.Box<i64>(i64.MIN_VALUE));
  const boxed = JSON.Obj.from(wide);
  __collect();
  expect(boxed.getAs<i64>("n")).toBe(i64.MIN_VALUE);
});
