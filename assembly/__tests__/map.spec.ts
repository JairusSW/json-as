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
