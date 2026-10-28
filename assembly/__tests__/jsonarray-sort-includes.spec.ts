import { JSON } from "..";
import { describe, expect } from "as-test";

let sorting = new JSON.Arr();
let changed = false;
function clearDuringSort(a: JSON.Value, b: JSON.Value): i32 {
  if (!changed) {
    changed = true;
    sorting.clear();
    __collect();
  }
  return <i32>(a.get<f64>() - b.get<f64>());
}

describe("Review: sort writes back its snapshot after callbacks mutate length", () => {
  sorting = JSON.parse<JSON.Arr>("[3,1,2]");
  changed = false;
  sorting.sort(clearDuringSort);
  expect(JSON.stringify(sorting)).toBe("[1,2,3]");
  __collect();
  expect(sorting.getAs<f64>(2)).toBe(3);
});

describe("Review: includes uses SameValueZero", () => {
  const values = new JSON.Arr();
  values.push<f64>(NaN);
  values.push<f64>(-0.0);
  expect(values.includes<f64>(NaN)).toBe(true);
  expect(values.indexOf<f64>(NaN)).toBe(-1);
  expect(values.includes<f64>(0.0)).toBe(true);
  const mixed = new JSON.Arr();
  mixed.push<i32>(1);
  mixed.push<string>("text");
  mixed.push<usize>(0);
  mixed.push<f32>(1);
  expect(mixed.includes<f64>(NaN)).toBe(false);
  expect(mixed.includes<f32>(NaN)).toBe(false);
  mixed.push<f32>(f32.NaN);
  expect(mixed.includes<f32>(f32.NaN)).toBe(true);
  expect(mixed.includes<f64>(NaN)).toBe(false);
  mixed.push<f64>(NaN);
  expect(mixed.includes<f64>(NaN)).toBe(true);
});
