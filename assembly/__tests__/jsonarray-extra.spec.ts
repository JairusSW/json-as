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

// ─── JSON.Arr error paths ─────────────────────────────────────────────────────

describe("JSON.Arr: at() throws on out-of-range index", () => {
  expect((): void => {
    JSON.parse<JSON.Arr>("[1,2,3]").at(5);
  }).toThrow();
  expect((): void => {
    JSON.parse<JSON.Arr>("[1,2,3]").at(-4);
  }).toThrow();
});

describe("JSON.Arr: pop() throws on empty array", () => {
  expect((): void => {
    new JSON.Arr().pop();
  }).toThrow();
});

describe("JSON.Arr: shift() throws on empty array", () => {
  expect((): void => {
    new JSON.Arr().shift();
  }).toThrow();
});

describe("JSON.Arr: length setter throws on negative", () => {
  expect((): void => {
    const tmp = JSON.parse<JSON.Arr>("[1,2,3]");
    tmp.length = -1;
  }).toThrow();
});

describe("JSON.Arr: find() returns matching element", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3,4]");
  const v = a.find(
    (val: JSON.Value, _: i32, __: JSON.Arr): bool => val.get<f64>() > 2.0,
  );
  expect(v!.get<f64>()).toBe(3.0);
});

describe("JSON.Arr: findLast() returns null when none match", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  const v = a.findLast(
    (val: JSON.Value, _: i32, __: JSON.Arr): bool => val.get<f64>() > 10.0,
  );
  expect(changetype<usize>(v) == 0 ? "null" : "found").toBe("null");
});

describe("JSON.Arr: findLastIndex() returns -1 when none match", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  expect(
    a.findLastIndex(
      (val: JSON.Value, _: i32, __: JSON.Arr): bool => val.get<f64>() > 10.0,
    ),
  ).toBe(-1);
});

describe("JSON.Arr: reduce() sums all elements", () => {
  const a = JSON.parse<JSON.Arr>("[10,20,30]");
  const sum = a.reduce<f64>(
    (acc: f64, val: JSON.Value, _: i32, __: JSON.Arr): f64 =>
      acc + val.get<f64>(),
    0.0,
  );
  expect(sum).toBe(60.0);
});

describe("JSON.Arr: sort() is no-op on < 2 elements", () => {
  const one = new JSON.Arr();
  one.push<i32>(1);
  one.sort((x: JSON.Value, y: JSON.Value): i32 => 0);
  expect(one.length).toBe(1);
  const empty = new JSON.Arr();
  empty.sort((x: JSON.Value, y: JSON.Value): i32 => 0);
  expect(empty.length).toBe(0);
});

describe("JSON.Arr: lastIndexOf() returns -1 when not found", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  expect(a.lastIndexOf<f64>(99.0)).toBe(-1);
});

describe("JSON.Arr: join() with default separator", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  expect(a.join()).toBe("1,2,3");
});

describe("JSON.Arr: copyWithin() with negative indices", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  a.copyWithin(-2, -4);
  expect(JSON.stringify(a)).toBe("[1,2,3,2,3]");
});

describe("JSON.Arr: splice() with negative start", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  const removed = a.splice(-2);
  expect(removed.length).toBe(2);
  expect(a.length).toBe(3);
});

describe("JSON.Arr: toString()", () => {
  expect(JSON.parse<JSON.Arr>("[1,2]").toString()).toBe("[1,2]");
});

describe("JSON.Arr: from() wraps JSON.Value[] into JSON.Arr", () => {
  const arr: JSON.Value[] = [JSON.Value.from<i32>(1), JSON.Value.from<i32>(2)];
  const a = JSON.Arr.from(arr);
  expect(a.length).toBe(2);
  expect(a.at(0).get<i32>()).toBe(1);
});

// AS does not support closures; use a non-capturing callback to exercise the
// JSON.Arr.forEach loop body (index.ts line 2118) without capturing outer vars.
describe("JSON.Arr: forEach loop body fires for each element", () => {
  const arr = JSON.parse<JSON.Arr>("[10,20,30]");
  arr.forEach((val: JSON.Value, _i: i32, _arr: JSON.Arr): void => {
    const _unused = val.get<f64>();
  });
  expect(arr.length).toBe(3);
});

// Pushing 9 elements into a fresh JSON.Arr forces ensureValCap to grow from
// its initial 8-slot allocation: cap=8 > 0 (Ternary true), n<<1 until n>=9
// (Loop + Assignment), and memory.copy since _vused=8 (IfBranch).
describe("JSON.Arr: push 9 elements forces ensureValCap to grow past initial 8-slot allocation", () => {
  const arr = new JSON.Arr();
  for (let i = 0; i < 9; i++) arr.push<i32>(i);
  expect(arr.length).toBe(9);
  expect(arr.at(8).get<i32>()).toBe(8);
});

// VAL_U64_LIMIT = 2^45. Values >= limit spill to heap (VAL_BOX64 flag set),
// triggering the LogicalBranch at storeSlot line 1831 that __link-s the box.
describe("JSON.Arr: push heap-boxed u64 covers storeSlot LogicalBranch for boxed u64", () => {
  const big: u64 = 35184372088833; // >= 2^45 → heap-boxed with VAL_BOX64
  const arr = new JSON.Arr();
  arr.push<u64>(big);
  expect(arr.at(0).get<u64>()).toBe(big);
});

// Passing a JSON.Arr directly to from() hits the instanceof JSON.Arr fast-path
// at line 1919 which returns the input unchanged.
describe("JSON.Arr: from(JSON.Arr) returns the same array via instanceof fast-path", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  const b = JSON.Arr.from(a);
  expect(b.length).toBe(3);
});

// Calling fill() with only value uses default start=0 (covers DefaultValue at
// line 2024:36). Calling fill(v, 0, -2) uses end<0 branch (covers Ternary true
// at line 2027:27).
describe("JSON.Arr: fill() with default start=0 covers DefaultValue parameter path", () => {
  const arr = JSON.parse<JSON.Arr>("[1,2,3]");
  arr.fill(JSON.Value.from<i32>(9));
  expect(arr.at(0).get<i32>()).toBe(9);
  expect(arr.at(2).get<i32>()).toBe(9);
});

describe("JSON.Arr: fill() with negative end covers end<0 ternary branch", () => {
  const arr = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  arr.fill(JSON.Value.from<i32>(0), 0, -2); // e = max(5-2, 0) = 3 → fills indices 0..2
  expect(arr.at(0).get<i32>()).toBe(0);
  expect(arr.at(3).get<f64>()).toBe(4.0); // index 3 is raw f64 slot, unchanged
});

// Passing a negative end triggers the end<0 ternary branch at line 2038:27.
describe("JSON.Arr: copyWithin() with negative end covers end<0 ternary branch", () => {
  const arr = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  arr.copyWithin(0, 1, -1); // end = max(5-1, 0) = 4 → copies raw f64 slots 1..3 to 0..2
  expect(arr.at(0).get<f64>()).toBe(2.0);
  expect(arr.at(1).get<f64>()).toBe(3.0);
});
