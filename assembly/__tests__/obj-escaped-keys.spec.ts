import { JSON } from "..";
import { describe, expect } from "as-test";

function checkKey(token: string, key: string): void {
  const source = "{" + token + ":1}";
  const obj = JSON.parse<JSON.Obj>(source);
  expect(JSON.stringify(obj)).toBe(source);
  expect(obj.has(key)).toBe(true);
  expect(obj.getAs<f64>(key)).toBe(1.0);
  expect(JSON.stringify(obj.keys())).toBe(JSON.stringify([key]));
  obj.set(key, 2.0);
  expect(obj.size).toBe(1);
  const canonical = "{" + JSON.stringify(key) + ":2}";
  expect(JSON.stringify(obj)).toBe(canonical);
  expect(JSON.parse<JSON.Obj>(canonical).getAs<f64>(key)).toBe(2.0);
  expect(obj.delete(key)).toBe(true);
  expect(obj.size).toBe(0);
}

describe("JSON.Obj decodes short key escapes once", () => {
  checkKey('"plain"', "plain");
  checkKey('""', "");
  checkKey('"\\u0061"', "a");
  checkKey('"\\u00e9"', "é");
  checkKey('"\\uD83D\\uDE00"', "😀");
  checkKey('"\\u0000"', "\u0000");
  checkKey('"quote\\\""', 'quote"');
  checkKey('"back\\\\slash"', "back\\slash");
  checkKey('"slash\\/"', "slash/");
  checkKey('"\\b\\f\\n\\r\\t"', "\b\f\n\r\t");
  checkKey('"\\\\u0061"', "\\u0061");
  checkKey('"\\\\\\\""', '\\"');
});

describe("JSON.Obj equivalent escaped keys retain last-value-wins lookup", () => {
  const small = JSON.parse<JSON.Obj>('{"a":1,"\\u0061":2}');
  expect(small.getAs<f64>("a")).toBe(2.0);
  expect(small.has("\\u0061")).toBe(false);
  expect(JSON.stringify(small.keys())).toBe('["a","a"]');
  small.set("a", 3.0);
  expect(small.size).toBe(2);
  expect(JSON.stringify(small)).toBe('{"a":1,"a":3}');

  const large = JSON.parse<JSON.Obj>(
    '{"\\u0061":1,"k0":0,"k1":1,"k2":2,"k3":3,"k4":4,"k5":5,"k6":6,"a":2,"\\u0061":3}',
  );
  expect(large.getAs<f64>("a")).toBe(3.0);
  expect(large.has("\\u0061")).toBe(false);
  large.set("a", 4.0);
  expect(large.size).toBe(10);
  expect(large.getAs<f64>("a")).toBe(4.0);
  expect(JSON.stringify(large)).toBe(
    '{"a":1,"k0":0,"k1":1,"k2":2,"k3":3,"k4":4,"k5":5,"k6":6,"a":2,"a":4}',
  );
});

describe("JSON.Obj key decoding leaves source-relative values lazy", () => {
  const source =
    '{"\\u0061":[1.0, 2.0],"child":{"\\u0062":3},"tail":"raw\\ntext"}';
  const obj = JSON.parse<JSON.Obj>(source);
  expect(obj.has("a")).toBe(true);
  expect(JSON.Value.slotIsLazy(obj._vals[0])).toBe(true);
  expect(JSON.Value.slotIsLazy(obj._vals[1])).toBe(true);
  expect(JSON.Value.slotIsLazy(obj._vals[2])).toBe(true);
  obj.set("extra", 4.0);
  expect(JSON.stringify(obj)).toBe(
    '{"a":[1.0, 2.0],"child":{"\\u0062":3},"tail":"raw\\ntext","extra":4}',
  );
  const child = obj.getAs<JSON.Obj>("child");
  expect(child.getAs<f64>("b")).toBe(3.0);
  child.set("b", 5.0);
  expect(JSON.stringify(obj)).toBe(
    '{"a":[1.0, 2.0],"child":{"b":5},"tail":"raw\\ntext","extra":4}',
  );
  if (obj.has("a")) expect(obj.getAs<JSON.Arr>("a").getAs<f64>(1)).toBe(2.0);
});

describe("JSON.Obj escaped keys work through dynamic values, arrays and reuse", () => {
  const value = JSON.parse<JSON.Value>('{"\\u0078":7}');
  expect(value.get<JSON.Obj>().getAs<f64>("x")).toBe(7.0);
  const array = JSON.parse<JSON.Obj[]>('[{"\\u0078":8},{"\\u0079":9}]');
  expect(array[0].getAs<f64>("x")).toBe(8.0);
  expect(array[1].getAs<f64>("y")).toBe(9.0);
  const out = new JSON.Obj();
  out.set("old", 1.0);
  const reused = JSON.parse<JSON.Obj>('{"\\u0078":10}', out);
  expect(reused === out).toBe(true);
  expect(out.has("old")).toBe(false);
  expect(out.getAs<f64>("x")).toBe(10.0);
  JSON.parse<JSON.Obj>('{"\\u0079":11}', out);
  expect(out.has("x")).toBe(false);
  expect(out.getAs<f64>("y")).toBe(11.0);
});

describe("Shared string decoding preserves escaped slash", () => {
  for (let prefixLength = 0; prefixLength < 16; prefixLength++) {
    const prefix = "x".repeat(prefixLength);
    for (let suffixLength = 0; suffixLength < 4; suffixLength++) {
      const suffix = "y".repeat(suffixLength);
      expect(JSON.parse<string>('"' + prefix + "\\/" + suffix + '"')).toBe(
        prefix + "/" + suffix,
      );
    }
  }
});

let invalidKeySource = "";

function expectInvalidKey(source: string): void {
  invalidKeySource = source;
  expect((): void => {
    JSON.parse<JSON.Obj>(invalidKeySource);
  }).toThrow();
}

describe("JSON.Obj rejects invalid short key escapes", () => {
  expectInvalidKey('{"\\q":1}');
  expectInvalidKey('{"\\u12":1}');
  expectInvalidKey('{"\\u00xz":1}');
  expect(JSON.parse<JSON.Obj>('{"\\u0061":2}').getAs<f64>("a")).toBe(2.0);
});
