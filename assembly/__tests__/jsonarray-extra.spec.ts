import { JSON } from "..";
import { describe, expect } from "as-test";

// Comprehensive coverage for the ported Array methods: edge cases (empty /
// negative / clamped indices), lazy-passthrough preservation, nested element
// types, mixed-type join, and GC stress. Callbacks are module-level named
// functions (AS function-typed params).

function gt15(v: JSON.Value, i: i32, a: JSON.Arr): bool {
  return v.get<f64>() > 15.0;
}
function isEven(v: JSON.Value, i: i32, a: JSON.Arr): bool {
  return <i32>v.get<f64>() % 2 == 0;
}
function keepAll(v: JSON.Value, i: i32, a: JSON.Arr): bool {
  return true;
}
function negate(v: JSON.Value, i: i32, a: JSON.Arr): JSON.Value {
  return JSON.Value.from<f64>(-v.get<f64>());
}
function addF(acc: f64, v: JSON.Value, i: i32, a: JSON.Arr): f64 {
  return acc + v.get<f64>();
}
function ascF(a: JSON.Value, b: JSON.Value): i32 {
  const x = a.get<f64>();
  const y = b.get<f64>();
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}
function descF(a: JSON.Value, b: JSON.Value): i32 {
  return ascF(b, a);
}

describe("JSON.Arr: empty-array edge cases", () => {
  const a = new JSON.Arr();
  expect(a.length).toBe(0);
  expect(JSON.stringify(a.slice())).toBe("[]");
  expect(a.indexOf<f64>(1.0)).toBe(-1);
  expect(a.includes<f64>(1.0) ? 1 : 0).toBe(0);
  expect(a.join(",")).toBe("");
  expect(a.every(gt15) ? 1 : 0).toBe(1); // vacuously true
  expect(a.some(gt15) ? 1 : 0).toBe(0);
  expect(a.find(gt15) == null ? 1 : 0).toBe(1);
  expect(a.findIndex(gt15)).toBe(-1);
  expect(a.reduce<f64>(addF, 100.0)).toBe(100.0);
});

describe("JSON.Arr: negative & clamped indices", () => {
  const a = JSON.parse<JSON.Arr>("[0,1,2,3,4]");
  expect(JSON.stringify(a.slice(-2))).toBe("[3,4]");
  expect(JSON.stringify(a.slice(1, -1))).toBe("[1,2,3]");
  expect(JSON.stringify(a.slice(-100, 100))).toBe("[0,1,2,3,4]");
  expect(JSON.stringify(a.slice(3, 1))).toBe("[]"); // start > end
  expect(a.indexOf<f64>(2.0, -3)).toBe(2);
  expect(a.lastIndexOf<f64>(1.0, -2)).toBe(1);
  expect(a.includes<f64>(0.0, 1) ? 1 : 0).toBe(0); // 0 is before fromIndex
});

describe("JSON.Arr: fill / copyWithin with negatives", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  a.fill<i32>(0, -2);
  expect(JSON.stringify(a)).toBe("[1,2,3,0,0]");
  const b = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  b.copyWithin(-2, 0, 2);
  expect(JSON.stringify(b)).toBe("[1,2,3,1,2]");
});

describe("JSON.Arr: splice none / to-end", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  expect(a.splice(1, 0).length).toBe(0);
  expect(JSON.stringify(a)).toBe("[1,2,3,4,5]");
  expect(JSON.stringify(a.splice(3))).toBe("[4,5]");
  expect(JSON.stringify(a)).toBe("[1,2,3]");
});

describe("JSON.Arr: slice preserves lazy passthrough (objects)", () => {
  const src = '[{"a":1},{"b":2},{"c":3}]';
  const a = JSON.parse<JSON.Arr>(src);
  expect(JSON.stringify(a.slice(0, 2))).toBe('[{"a":1},{"b":2}]');
  expect(JSON.stringify(a.slice(1))).toBe('[{"b":2},{"c":3}]');
});

describe("JSON.Arr: filter preserves lazy strings (verbatim)", () => {
  const a = JSON.parse<JSON.Arr>('["aa","bbbb","c","dddd"]');
  expect(JSON.stringify(a.filter(keepAll))).toBe('["aa","bbbb","c","dddd"]');
});

describe("JSON.Arr: nested objects via at / [] ", () => {
  const a = JSON.parse<JSON.Arr>('[{"id":1},{"id":2},{"id":3}]');
  expect(a.at(1).get<JSON.Obj>().getAs<f64>("id")).toBe(2.0);
  expect(a[2].get<JSON.Obj>().getAs<f64>("id")).toBe(3.0);
});

describe("JSON.Arr: map / reduce / reduceRight", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  expect(JSON.stringify(a.map(negate))).toBe("[-1,-2,-3]");
  expect(a.reduce<f64>(addF, 0.0)).toBe(6.0);
  expect(a.reduceRight<f64>(addF, 0.0)).toBe(6.0);
});

describe("JSON.Arr: findLast / findLastIndex", () => {
  const a = JSON.parse<JSON.Arr>("[10,20,30,5]");
  const fl = a.findLast(gt15);
  expect(fl == null ? -1.0 : fl.get<f64>()).toBe(30.0);
  expect(a.findLastIndex(gt15)).toBe(2);
});

describe("JSON.Arr: sort asc / desc", () => {
  const a = JSON.parse<JSON.Arr>("[3,1,2,5,4]");
  a.sort(ascF);
  expect(JSON.stringify(a)).toBe("[1,2,3,4,5]");
  a.sort(descF);
  expect(JSON.stringify(a)).toBe("[5,4,3,2,1]");
});

describe("JSON.Arr: reverse strings", () => {
  const a = JSON.parse<JSON.Arr>('["a","b","c"]');
  a.reverse();
  expect(JSON.stringify(a)).toBe('["c","b","a"]');
});

describe("JSON.Arr: concat lazy from different sources", () => {
  const a = JSON.parse<JSON.Arr>('["x",{"k":1}]');
  const b = JSON.parse<JSON.Arr>("[true,[1,2]]");
  expect(JSON.stringify(a.concat(b))).toBe('["x",{"k":1},true,[1,2]]');
});

describe("JSON.Arr: join mixed (string / number / bool / null / nested)", () => {
  const a = JSON.parse<JSON.Arr>('["a",1,true,null,{"k":2}]');
  expect(a.join("|")).toBe('a|1|true||{"k":2}');
});

describe("JSON.Arr: length truncate then push", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3,4]");
  a.length = 2;
  a.push<i32>(9);
  expect(JSON.stringify(a)).toBe("[1,2,9]");
});

describe("JSON.Arr: [] write a nested value", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  a[1] = JSON.parse<JSON.Value>('{"x":5}');
  expect(JSON.stringify(a)).toBe('[1,{"x":5},3]');
});

describe("JSON.Arr: build via push then transform", () => {
  const a = new JSON.Arr();
  // push<f64> so callbacks reading get<f64> match the stored boxing.
  for (let i = 1; i <= 5; i++) a.push<f64>(<f64>i);
  expect(a.filter(isEven).length).toBe(2); // 2, 4
  expect(JSON.stringify(a.map(negate))).toBe("[-1,-2,-3,-4,-5]");
});

describe("JSON.Arr: unshift / shift sequence", () => {
  const a = JSON.parse<JSON.Arr>("[2,3]");
  expect(a.unshift<i32>(1)).toBe(3);
  expect(JSON.stringify(a)).toBe("[1,2,3]");
  a.shift();
  a.shift();
  expect(a.length).toBe(1);
  expect(JSON.stringify(a)).toBe("[3]");
});

describe("JSON.Arr: GC stress over methods", () => {
  let total = 0.0;
  for (let i = 0; i < 500; i++) {
    const a = JSON.parse<JSON.Arr>(
      '[1,2,3,"hello",{"k":' + i.toString() + "}]",
    );
    total += a.slice(0, 3).reduce<f64>(addF, 0.0); // 6 per iteration
  }
  expect(total).toBe(3000.0);
});
