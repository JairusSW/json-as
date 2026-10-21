import { JSON } from "..";
import { describe, expect } from "as-test";

describe("JSON.Obj.delete removes every occurrence of a parsed key", () => {
  const obj = JSON.parse<JSON.Obj>('{"a":1,"keep":2,"a":3}');
  expect(obj.getAs<f64>("a")).toBe(3.0);
  expect(obj.delete("a")).toBe(true);
  expect(obj.has("a")).toBe(false);
  expect(obj.get("a") === null).toBe(true);
  expect(obj.getAs<f64>("a")).toBe(0.0);
  expect(obj.size).toBe(1);
  expect(JSON.stringify(obj.keys())).toBe('["keep"]');
  expect(JSON.stringify(obj)).toBe('{"keep":2}');
  expect(obj.delete("a")).toBe(false);
  obj.set("a", 4.0);
  expect(obj.size).toBe(2);
  expect(obj.getAs<f64>("a")).toBe(4.0);
  expect(JSON.stringify(obj)).toBe('{"keep":2,"a":4}');
});

describe("JSON.Obj.delete removes duplicates after indexed lookup", () => {
  const obj = JSON.parse<JSON.Obj>(
    '{"a":1,"k0":0,"k1":1,"a":2,"k2":2,"k3":3,"k4":4,"k5":5,"k6":6,"a":3,"k7":7}',
  );
  expect(obj.getAs<f64>("a")).toBe(3.0);
  expect(obj.has("missing")).toBe(false);
  expect(obj.delete("a")).toBe(true);
  expect(obj.size).toBe(8);
  expect(obj.has("a")).toBe(false);
  expect(obj.get("a") === null).toBe(true);
  expect(obj.delete("a")).toBe(false);
  for (let i = 0; i < 8; i++) {
    expect(obj.has("k" + i.toString())).toBe(true);
    expect(obj.getAs<f64>("k" + i.toString())).toBe(<f64>i);
  }
  expect(JSON.stringify(obj)).toBe(
    '{"k0":0,"k1":1,"k2":2,"k3":3,"k4":4,"k5":5,"k6":6,"k7":7}',
  );
  obj.set("a", 5.0);
  expect(obj.getAs<f64>("a")).toBe(5.0);
  expect(obj.delete("a")).toBe(true);
  expect(obj.size).toBe(8);
});

describe("JSON.Obj.delete leaves unrelated duplicates and order unchanged", () => {
  const obj = JSON.parse<JSON.Obj>(
    '{"remove":1,"keep":2,"remove":3,"keep":4,"tail":5}',
  );
  expect(obj.delete("remove")).toBe(true);
  expect(obj.size).toBe(3);
  expect(JSON.stringify(obj.keys())).toBe('["keep","keep","tail"]');
  expect(obj.getAs<f64>("keep")).toBe(4.0);
  expect(JSON.stringify(obj)).toBe('{"keep":2,"keep":4,"tail":5}');
  expect(obj.delete("keep")).toBe(true);
  expect(JSON.stringify(obj)).toBe('{"tail":5}');
});

describe("JSON.Obj.delete handles empty and Unicode keys", () => {
  const obj = JSON.parse<JSON.Obj>('{"a":1,"a":2,"":3,"":4,"é":5,"é":6}');
  expect(obj.getAs<f64>("a")).toBe(2.0);
  expect(obj.delete("a")).toBe(true);
  expect(obj.has("a")).toBe(false);
  expect(obj.getAs<f64>("")).toBe(4.0);
  expect(obj.delete("")).toBe(true);
  expect(obj.has("")).toBe(false);
  expect(obj.getAs<f64>("é")).toBe(6.0);
  expect(obj.delete("é")).toBe(true);
  expect(obj.size).toBe(0);
  expect(JSON.stringify(obj)).toBe("{}");
  expect(obj.delete("é")).toBe(false);
  obj.set("new", true);
  expect(JSON.stringify(obj)).toBe('{"new":true}');
});

describe("JSON.Obj.delete preserves lazy and materialized surviving values", () => {
  const obj = JSON.parse<JSON.Obj>(
    '{"remove":{"old":1},"lazy":[1.0, 2.0],"child":{"v":3},"remove":[4],"tail":{"n": 5.0}}',
  );
  const child = obj.getAs<JSON.Obj>("child");
  expect(JSON.Value.slotIsLazy(obj._vals[1])).toBe(true);
  expect(JSON.Value.slotIsLazy(obj._vals[4])).toBe(true);
  expect(obj.delete("remove")).toBe(true);
  expect(obj.size).toBe(3);
  expect(JSON.stringify(obj.keys())).toBe('["lazy","child","tail"]');
  expect(JSON.Value.slotIsLazy(obj._vals[0])).toBe(true);
  expect(JSON.Value.slotIsLazy(obj._vals[2])).toBe(true);
  expect(obj.getAs<JSON.Obj>("child") === child).toBe(true);
  child.set("v", 9.0);
  expect(JSON.stringify(obj)).toBe(
    '{"lazy":[1.0, 2.0],"child":{"v":9},"tail":{"n": 5.0}}',
  );
  expect(obj.getAs<JSON.Arr>("lazy").getAs<f64>(1)).toBe(2.0);
  expect(obj.getAs<JSON.Obj>("tail").getAs<f64>("n")).toBe(5.0);
});

describe("JSON.Obj.delete of a missing key preserves raw passthrough", () => {
  const source = '{ "a" : 1, "a" : 2 }';
  const obj = JSON.parse<JSON.Obj>(source);
  expect(obj.delete("missing")).toBe(false);
  expect(obj.size).toBe(2);
  expect(JSON.stringify(obj)).toBe(source);
  expect(obj.getAs<f64>("a")).toBe(2.0);
});
