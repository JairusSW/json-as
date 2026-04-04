import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class MapValue {
  id: i32 = 0;
  name: string = "";
}

describe("Should deserialize complex objects", () => {
  const input = '{"a":{"b":{"c":[{"d":"random value 1"},{"e":["value 2","value 3"]}],"f":{"g":{"h":[1,2,3],"i":{"j":"nested value"}}}},"k":"simple value"},"l":[{"m":"another value","n":{"o":"deep nested","p":[{"q":"even deeper"},"final value"]}}],"r":null}';
  expect(JSON.stringify(JSON.parse<Map<string, JSON.Raw>>(input))).toBe(input);
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should serialize and deserialize primitive maps", () => {
  const m = new Map<string, i32>();
  m.set("one", 1);
  m.set("two", 2);
  expect(JSON.stringify(m)).toBe('{"one":1,"two":2}');
  expect(JSON.stringify(JSON.parse<Map<string, i32>>('{"one":1,"two":2}'))).toBe('{"one":1,"two":2}');
});

describe("Should serialize and deserialize nested map values", () => {
  const m = new Map<string, string[]>();
  m.set("letters", ["a", "b", "c"]);
  expect(JSON.stringify(m)).toBe('{"letters":["a","b","c"]}');
  expect(JSON.stringify(JSON.parse<Map<string, string[]>>('{"letters":["a","b","c"]}'))).toBe('{"letters":["a","b","c"]}');
});

describe("Should handle maps with booleans, floats, and whitespace", () => {
  expect(JSON.stringify(JSON.parse<Map<string, bool>>('{ "yes" : true , "no" : false }'))).toBe('{"yes":true,"no":false}');
  expect(JSON.stringify(JSON.parse<Map<string, f64>>('{ "pi" : 3.14 , "e" : 2.718 }'))).toBe('{"pi":3.14,"e":2.718}');
});

describe("Should serialize and deserialize maps with boolean keys", () => {
  const parsed = JSON.parse<Map<bool, i32>>('{"true":1,"false":2}');
  expect(parsed.get(true)).toBe(1);
  expect(parsed.get(false)).toBe(2);
  expect(JSON.stringify(parsed)).toBe('{"true":1,"false":2}');
});

describe("Should serialize and deserialize maps with integer keys", () => {
  const m = new Map<i32, string>();
  m.set(1, "one");
  m.set(-2, "two");
  expect(JSON.stringify(m)).toBe('{"1":"one","-2":"two"}');

  const parsed = JSON.parse<Map<i32, string>>('{"1":"one","-2":"two"}');
  expect(parsed.get(1)).toBe("one");
  expect(parsed.get(-2)).toBe("two");
  expect(JSON.stringify(parsed)).toBe('{"1":"one","-2":"two"}');
});

describe("Should serialize and deserialize maps with float keys", () => {
  const m = new Map<f64, i32>();
  m.set(3.5, 1);
  m.set(-0.125, 2);
  expect(JSON.stringify(m)).toBe('{"3.5":1,"-0.125":2}');

  const parsed = JSON.parse<Map<f64, i32>>('{"3.5":1,"-0.125":2}');
  const keys = parsed.keys();
  expect(keys.length).toBe(2);
  expect(keys[0].toString()).toBe("3.5");
  expect(keys[1].toString()).toBe("-0.125");
  expect(parsed.values()[0]).toBe(1);
  expect(parsed.values()[1]).toBe(2);
  expect(JSON.stringify(parsed)).toBe('{"3.5":1,"-0.125":2}');
});

describe("Should serialize and deserialize maps with date keys", () => {
  const m = new Map<Date, i32>();
  m.set(new Date(0), 1);
  m.set(new Date(1738618120525), 2);
  expect(JSON.stringify(m)).toBe('{"\\"1970-01-01T00:00:00.000Z\\"":1,"\\"2025-02-03T21:28:40.525Z\\"":2}');

  const parsed = JSON.parse<Map<Date, i32>>('{"\\"1970-01-01T00:00:00.000Z\\"":1,"\\"2025-02-03T21:28:40.525Z\\"":2}');
  const keys = parsed.keys();
  expect(keys.length).toBe(2);
  expect(keys[0].getTime().toString()).toBe("0");
  expect(keys[1].getTime().toString()).toBe("1738618120525");
  expect(parsed.values()[0]).toBe(1);
  expect(parsed.values()[1]).toBe(2);
  expect(JSON.stringify(parsed)).toBe('{"\\"1970-01-01T00:00:00.000Z\\"":1,"\\"2025-02-03T21:28:40.525Z\\"":2}');
});

describe("Should serialize and deserialize maps with struct keys", () => {
  const m = new Map<MapValue, i32>();
  m.set({ id: 1, name: "alice" }, 10);
  m.set({ id: 2, name: "bob" }, 20);
  expect(JSON.stringify(m)).toBe('{"{\\"id\\":1,\\"name\\":\\"alice\\"}":10,"{\\"id\\":2,\\"name\\":\\"bob\\"}":20}');

  const parsed = JSON.parse<Map<MapValue, i32>>('{"{\\"id\\":1,\\"name\\":\\"alice\\"}":10,"{\\"id\\":2,\\"name\\":\\"bob\\"}":20}');
  const keys = parsed.keys();
  expect(keys.length).toBe(2);
  expect(keys[0].id).toBe(1);
  expect(keys[0].name).toBe("alice");
  expect(keys[1].id).toBe(2);
  expect(keys[1].name).toBe("bob");
  expect(parsed.values()[0]).toBe(10);
  expect(parsed.values()[1]).toBe(20);
  expect(JSON.stringify(parsed)).toBe('{"{\\"id\\":1,\\"name\\":\\"alice\\"}":10,"{\\"id\\":2,\\"name\\":\\"bob\\"}":20}');
});

describe("Should serialize and deserialize maps with array keys", () => {
  const m = new Map<i32[], string>();
  m.set([1, 2], "a");
  m.set([3], "b");
  expect(JSON.stringify(m)).toBe('{"[1,2]":"a","[3]":"b"}');

  const parsed = JSON.parse<Map<i32[], string>>('{"[1,2]":"a","[3]":"b"}');
  const keys = parsed.keys();
  expect(keys.length).toBe(2);
  expect(JSON.stringify(keys[0])).toBe("[1,2]");
  expect(JSON.stringify(keys[1])).toBe("[3]");
  expect(parsed.values()[0]).toBe("a");
  expect(parsed.values()[1]).toBe("b");
  expect(JSON.stringify(parsed)).toBe('{"[1,2]":"a","[3]":"b"}');
});

describe("Should round-trip maps with nested object values", () => {
  const parsed = JSON.parse<Map<string, MapValue>>('{"a":{"id":1,"name":"alice"},"b":{"id":2,"name":"bob"}}');
  expect(parsed.get("a")!.id.toString()).toBe("1");
  expect(parsed.get("a")!.name).toBe("alice");
  expect(parsed.get("b")!.id.toString()).toBe("2");
  expect(parsed.get("b")!.name).toBe("bob");
  expect(JSON.stringify(parsed)).toBe('{"a":{"id":1,"name":"alice"},"b":{"id":2,"name":"bob"}}');
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
