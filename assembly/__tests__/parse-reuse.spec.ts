import { JSON } from "..";
import { describe, expect } from "as-test";

// `JSON.parse<T>(data, out)` should deserialize into the caller-supplied handle
// (reusing it, no fresh allocation) for the dynamic types, with no stale data
// carried over from a previous parse. (Parsed numbers read back via getAs<f64>,
// the JSON.Obj convention - parse stores numbers as raw f64.)

function same(a: usize, b: usize): string {
  return a == b ? "same" : "diff";
}

describe("JSON.parse reuse: JSON.Obj writes into out", () => {
  const out = new JSON.Obj();
  const a = JSON.parse<JSON.Obj>('{"a":1,"b":2}', out);
  expect(same(changetype<usize>(a), changetype<usize>(out))).toBe("same");
  expect(a.size).toBe(2);
  expect(a.getAs<f64>("a")).toBe(1.0);
  expect(a.getAs<f64>("b")).toBe(2.0);
});

describe("JSON.parse reuse: JSON.Obj drops stale entries", () => {
  const out = new JSON.Obj();
  JSON.parse<JSON.Obj>('{"a":1,"b":2,"c":3}', out);
  const b = JSON.parse<JSON.Obj>('{"x":9}', out);
  expect(b.size).toBe(1);
  expect(b.getAs<f64>("x")).toBe(9.0);
  expect(b.get("a") == null ? "gone" : "stale").toBe("gone");
  expect(JSON.stringify(b)).toBe('{"x":9}');
});

describe("JSON.parse reuse: JSON.Arr writes into out + no stale", () => {
  const out = new JSON.Arr();
  const a = JSON.parse<JSON.Arr>("[1,2,3]", out);
  expect(same(changetype<usize>(a), changetype<usize>(out))).toBe("same");
  expect(a.length).toBe(3);
  const b = JSON.parse<JSON.Arr>("[7]", out);
  expect(b.length).toBe(1);
  expect(b.getAs<f64>(0)).toBe(7.0);
  expect(JSON.stringify(b)).toBe("[7]");
});

describe("JSON.parse reuse: JSON.Value writes into out", () => {
  const out = JSON.Value.from<i32>(0);
  const a = JSON.parse<JSON.Value>('{"k":5}', out);
  expect(same(changetype<usize>(a), changetype<usize>(out))).toBe("same");
  expect(JSON.stringify(a)).toBe('{"k":5}');
  const b = JSON.parse<JSON.Value>("42", out);
  expect(same(changetype<usize>(b), changetype<usize>(out))).toBe("same");
  expect(JSON.stringify(b)).toBe("42");
});

describe("JSON.parse reuse: nested round-trips byte-exact", () => {
  const src = '{"id":7,"tags":[1,2,3],"meta":{"k":"v"}}';
  const out = new JSON.Obj();
  expect(JSON.stringify(JSON.parse<JSON.Obj>(src, out))).toBe(src);
});

describe("JSON.parse reuse: GC stress (1000 parses into one handle)", () => {
  const out = new JSON.Obj();
  for (let i = 0; i < 1000; i++) {
    JSON.parse<JSON.Obj>(
      '{"n":' + i.toString() + ',"s":"hello world","arr":[1,2,3,4,5]}',
      out,
    );
  }
  expect(out.size).toBe(3);
  expect(out.getAs<f64>("n")).toBe(999.0);
  expect(out.getAs<string>("s")).toBe("hello world");
});
