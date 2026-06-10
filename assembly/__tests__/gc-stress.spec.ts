import { JSON } from "..";
import { describe, expect } from "as-test";

// Forced-GC stress for the buffer-backed dynamic types. Every backing buffer a
// JSON.Obj/Arr/Value points at (source string, key bytes, key offsets, value
// slots, hash index, lazy slices) must be reachable from __visit, or a
// collection between parse and access frees it and faults / returns garbage.
// A single __collect() is enough to surface a missing trace (that's how the
// _kpos use-after-free showed up); we add heap churn to make reuse likely.

// Allocates and immediately drops garbage so freed blocks get reused, turning a
// dangling pointer into observably-wrong data rather than a silent survivor.
function churn(): void {
  for (let i = 0; i < 64; i++) {
    const s = "garbage-" + i.toString() + "-" + (i * 7).toString();
    blackhole(<i32>s.length);
    const a = new Array<i32>(16);
    for (let j = 0; j < 16; j++) unchecked((a[j] = i * j));
    blackhole(unchecked(a[15]));
  }
}

let SINK: i32 = 0;
// @ts-ignore: decorator
@inline function blackhole(v: i32): void {
  SINK ^= v;
}

function collect(): void {
  churn();
  __collect();
  churn();
  __collect();
}

describe("GC: small JSON.Obj (linear path) survives collection", () => {
  const o = JSON.parse<JSON.Obj>('{"a":1,"b":2,"c":3}');
  collect();
  expect(o.getAs<f64>("a")).toBe(1.0);
  expect(o.getAs<f64>("b")).toBe(2.0);
  expect(o.getAs<f64>("c")).toBe(3.0);
  expect(o.has("c") ? 1 : 0).toBe(1);
  expect(o.has("z") ? 1 : 0).toBe(0);
  expect(JSON.stringify(o)).toBe('{"a":1,"b":2,"c":3}');
});

describe("GC: large JSON.Obj (hash-index path) survives collection", () => {
  let src = "{";
  for (let i = 0; i < 40; i++) {
    if (i > 0) src += ",";
    src += '"key' + i.toString() + '":' + i.toString();
  }
  src += "}";
  const o = JSON.parse<JSON.Obj>(src);
  collect();
  let sum = 0.0;
  for (let i = 0; i < 40; i++) sum += o.getAs<f64>("key" + i.toString());
  expect(sum).toBe(780.0); // 0+1+…+39
  // Force the hash index to (re)build after GC, then look up again.
  collect();
  expect(o.getAs<f64>("key39")).toBe(39.0);
  expect(o.has("key17") ? 1 : 0).toBe(1);
});

describe("GC: JSON.Obj built via set() survives collection", () => {
  const o = new JSON.Obj();
  for (let i = 0; i < 20; i++) o.set<f64>("f" + i.toString(), <f64>(i * 2));
  collect();
  for (let i = 0; i < 20; i++) {
    expect(o.getAs<f64>("f" + i.toString())).toBe(<f64>(i * 2));
  }
  o.set<string>("extra", "value");
  collect();
  expect(o.getAs<string>("extra")).toBe("value");
  expect(o.size).toBe(21);
});

describe("GC: JSON.Obj with a >16KB value survives collection", () => {
  const big = "x".repeat(20000);
  const o = JSON.parse<JSON.Obj>('{"big":"' + big + '","n":1}');
  collect();
  // untouched passthrough still byte-exact after GC
  expect(JSON.stringify(o)).toBe('{"big":"' + big + '","n":1}');
  collect();
  expect(o.getAs<string>("big").length).toBe(20000);
  expect(o.getAs<f64>("n")).toBe(1.0);
});

describe("GC: JSON.Arr survives collection", () => {
  const a = JSON.parse<JSON.Arr>('[1,"two",3,{"k":4},[5,6]]');
  collect();
  expect(a.length).toBe(5);
  expect(a.getAs<f64>(0)).toBe(1.0);
  expect(a.getAs<string>(1)).toBe("two");
  expect(a.at(3).get<JSON.Obj>().getAs<f64>("k")).toBe(4.0);
  expect(JSON.stringify(a)).toBe('[1,"two",3,{"k":4},[5,6]]');
});

describe("GC: lazy JSON.Value materializes correctly after collection", () => {
  const v = JSON.parse<JSON.Value>('{"outer":{"inner":[10,20,30]}}');
  collect(); // before any access — slice pointers must stay anchored
  const inner = v.get<JSON.Obj>().get("outer")!.get<JSON.Obj>().get("inner")!;
  collect(); // after one peel — the returned slice must outlive its parent
  expect(JSON.stringify(inner)).toBe("[10,20,30]");
  expect(inner.get<JSON.Arr>().getAs<f64>(2)).toBe(30.0);
});

describe("GC: deeply nested object peeled across collections", () => {
  const v = JSON.parse<JSON.Obj>('{"a":{"b":{"c":{"d":"deep"}}}}');
  const a = v.get("a")!;
  collect();
  const b = a.get<JSON.Obj>().get("b")!;
  collect();
  const c = b.get<JSON.Obj>().get("c")!;
  collect();
  expect(c.get<JSON.Obj>().getAs<string>("d")).toBe("deep");
});

describe("GC: repeated collections with many live objects", () => {
  const objs = new Array<JSON.Obj>(50);
  for (let i = 0; i < 50; i++) {
    objs[i] = JSON.parse<JSON.Obj>(
      '{"id":' + i.toString() + ',"name":"obj' + i.toString() + '"}',
    );
  }
  for (let round = 0; round < 3; round++) {
    collect();
    let idSum = 0.0;
    for (let i = 0; i < 50; i++) {
      idSum += objs[i].getAs<f64>("id");
      expect(objs[i].getAs<string>("name")).toBe("obj" + i.toString());
    }
    expect(idSum).toBe(1225.0); // 0+1+…+49
  }
});
