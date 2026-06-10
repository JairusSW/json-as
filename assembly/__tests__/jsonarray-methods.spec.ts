import { JSON } from "..";
import { describe, expect } from "as-test";

describe("JSON.Arr: stack ops", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  expect(a.pop().get<f64>()).toBe(3.0);
  expect(a.length).toBe(2);
  expect(a.shift().get<f64>()).toBe(1.0);
  expect(a.length).toBe(1);
  expect(a.unshift<i32>(9)).toBe(2);
  expect(a.getAs<i32>(0)).toBe(9);
});

describe("JSON.Arr: reverse / fill / copyWithin", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3,4]");
  a.reverse();
  expect(JSON.stringify(a)).toBe("[4,3,2,1]");
  a.fill<i32>(0, 1, 3);
  expect(JSON.stringify(a)).toBe("[4,0,0,1]");
  const b = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  b.copyWithin(0, 3);
  expect(JSON.stringify(b)).toBe("[4,5,3,4,5]");
});

describe("JSON.Arr: slice / splice / concat", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  expect(JSON.stringify(a.slice(1, 3))).toBe("[2,3]");
  expect(JSON.stringify(a.slice(-2))).toBe("[4,5]");
  const removed = a.splice(1, 2);
  expect(JSON.stringify(removed)).toBe("[2,3]");
  expect(JSON.stringify(a)).toBe("[1,4,5]");
  const c = JSON.parse<JSON.Arr>("[1,2]").concat(JSON.parse<JSON.Arr>("[3,4]"));
  expect(JSON.stringify(c)).toBe("[1,2,3,4]");
});

describe("JSON.Arr: search", () => {
  const a = JSON.parse<JSON.Arr>("[10,20,30,20]");
  expect(a.indexOf<f64>(20.0)).toBe(1);
  expect(a.lastIndexOf<f64>(20.0)).toBe(3);
  expect(a.includes<f64>(30.0) ? 1 : 0).toBe(1);
  expect(a.includes<f64>(99.0) ? 1 : 0).toBe(0);
});

function isBig(v: JSON.Value, i: i32, a: JSON.Arr): bool {
  return v.get<f64>() > 15.0;
}
function dbl(v: JSON.Value, i: i32, a: JSON.Arr): JSON.Value {
  return JSON.Value.from<f64>(v.get<f64>() * 2);
}
function sum(acc: f64, v: JSON.Value, i: i32, a: JSON.Arr): f64 {
  return acc + v.get<f64>();
}

describe("JSON.Arr: iterators", () => {
  const a = JSON.parse<JSON.Arr>("[10,20,30]");
  expect(JSON.stringify(a.filter(isBig))).toBe("[20,30]");
  expect(JSON.stringify(a.map(dbl))).toBe("[20,40,60]");
  expect(a.reduce<f64>(sum, 0.0)).toBe(60.0);
  expect(a.some(isBig) ? 1 : 0).toBe(1);
  expect(a.every(isBig) ? 1 : 0).toBe(0);
  expect(a.findIndex(isBig)).toBe(1);
});

describe("JSON.Arr: join / length", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  expect(a.join("-")).toBe("1-2-3");
  a.length = 2;
  expect(JSON.stringify(a)).toBe("[1,2]");
  a.length = 4;
  expect(JSON.stringify(a)).toBe("[1,2,null,null]");
});
