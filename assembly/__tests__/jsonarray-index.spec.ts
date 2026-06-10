import { JSON } from "..";
import { describe, expect } from "as-test";

describe("JSON.Arr [] operator: read", () => {
  const a = JSON.parse<JSON.Arr>("[10,20,30]");
  // arr[i] returns a JSON.Value (like at(i))
  expect(a[0].get<f64>()).toBe(10.0);
  expect(a[1].get<f64>()).toBe(20.0);
  expect(a[2].get<f64>()).toBe(30.0);
});

describe("JSON.Arr [] operator: write", () => {
  const a = JSON.parse<JSON.Arr>("[10,20,30]");
  a[1] = JSON.Value.from<i32>(99);
  expect(a.getAs<i32>(1)).toBe(99);
  expect(JSON.stringify(a)).toBe("[10,99,30]");
});

describe("JSON.Arr [] operator: build + index", () => {
  const a = new JSON.Arr();
  a.push<i32>(1);
  a.push<string>("two");
  a[0] = JSON.Value.from<i32>(5);
  expect(a[0].get<i32>()).toBe(5);
  expect(a[1].get<string>()).toBe("two");
  expect(a.length).toBe(2);
});
