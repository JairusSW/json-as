import { JSON } from "..";
import { describe, expect } from "as-test";

function check<S>(source: S): void {
  const value = JSON.Value.from<S>(source);
  expect(value.get<i8>()).toBe(<i8>source);
  expect(value.get<u8>()).toBe(<u8>source);
  expect(value.get<i16>()).toBe(<i16>source);
  expect(value.get<u16>()).toBe(<u16>source);
  expect(value.get<i32>()).toBe(<i32>source);
  expect(value.get<u32>()).toBe(<u32>source);
  expect(value.get<i64>()).toBe(<i64>source);
  expect(value.get<u64>()).toBe(<u64>source);
  expect(value.get<isize>()).toBe(<isize>source);
  expect(value.get<usize>()).toBe(<usize>source);
  expect(value.get<f32>()).toBe(<f32>source);
  expect(value.get<f64>()).toBe(<f64>source);
  expect(value.get<bool>()).toBe(source != 0);
}

describe("Numeric getters match native casts across stored representations", () => {
  check<i8>(-7); check<u8>(250);
  check<i16>(-1234); check<u16>(60000);
  check<i32>(-123456); check<u32>(4000000000);
  check<i64>(-17592186044417); check<i64>(-7);
  check<u64>(9007199254740993); check<u64>(7);
  check<i64>(i64.MIN_VALUE); check<i64>(i64.MAX_VALUE); check<u64>(u64.MAX_VALUE);
  check<f32>(-7.5); check<f64>(-7.5);
  check<f32>(-0.0); check<f64>(-0.0);
  check<bool>(true); check<bool>(false);
});

describe("Parsed and container numeric getters convert consistently", () => {
  const value = JSON.parse<JSON.Value>("7.5");
  expect(value.get<i32>()).toBe(7);
  expect(value.as<f32>()).toBe(<f32>7.5);
  const object = JSON.parse<JSON.Obj>('{"n":-7.5}');
  expect(object.getAs<i64>("n")).toBe(-7);
  const array = JSON.parse<JSON.Arr>("[7.5,0]");
  expect(array.getAs<u32>(0)).toBe(7);
  expect(array.getAs<bool>(1)).toBe(false);
  const wide = JSON.Value.from<u64>(9007199254740993);
  expect(wide.get<u64>()).toBe(9007199254740993);
  expect(wide.get<f64>()).toBe(<f64>9007199254740993);
  expect(JSON.Box.fromValue<i32>(value)!.value).toBe(7);
});

describe("Numeric edge cases preserve signs and special values", () => {
  expect(1.0 / JSON.Value.from<f64>(-0.0).get<f64>() == -Infinity).toBe(true);
  expect(1.0 / JSON.Value.from<f32>(-0.0).get<f64>() == -Infinity).toBe(true);
  expect(JSON.Value.from<f64>(NaN).get<bool>()).toBe(true);
  expect(JSON.Value.from<f32>(NaN).get<bool>()).toBe(true);
  expect(isNaN(JSON.Value.from<f64>(NaN).get<f32>())).toBe(true);
  expect(JSON.Value.from<f64>(Infinity).get<f32>() == <f32>Infinity).toBe(true);
  expect(JSON.Value.empty().get<i64>()).toBe(0);
});

describe("Getter shortcuts retain deferred materialization and mutable tags", () => {
  const root = JSON.parse<JSON.Value>('{"n":7.5}');
  expect(root.get<JSON.Obj>().getAs<i32>("n")).toBe(7);
  const value = JSON.Value.from<i32>(9);
  expect(value.get<i32>()).toBe(9);
  value.set<f64>(2.5);
  expect(value.get<i32>()).toBe(2);
  const object = new JSON.Obj();
  expect(JSON.Value.from(object).get<JSON.Obj>() === object).toBe(true);
});
