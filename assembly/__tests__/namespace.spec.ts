import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize namespaced derived structs", () => {
  const obj: Namespace.DerivedObject = { a: "foo", b: "bar" };
  expect(JSON.stringify(obj)).toBe(`{"a":"foo","b":"bar"}`);
});

describe("Should serialize namespaced derived structs with nested object", () => {
  const bar: Namespace.Bar = { value: "baz" };
  const obj: Namespace.DerivedObjectWithNestedObject = {
    a: "foo",
    b: "bar",
    c: bar,
  };
  expect(JSON.stringify(obj)).toBe(`{"a":"foo","b":"bar","c":{"value":"baz"}}`);
});

describe("Should deserialize namespaced object with alias property", () => {
  expect(JSON.stringify(JSON.parse<Namespace.ObjectWithAliasProperty>(`{"a":"foo","value":42}`))).toBe(`{"a":"foo","value":42}`);
});

describe("Should deserialize namespaced derived structs", () => {
  expect(JSON.stringify(JSON.parse<Namespace.DerivedObject>(`{"a":"foo","b":"bar"}`))).toBe(`{"a":"foo","b":"bar"}`);
  expect(JSON.stringify(JSON.parse<Namespace.DerivedObject>(`{"b":"bar","a":"foo"}`))).toBe(`{"a":"foo","b":"bar"}`);
});

describe("Should deserialize namespaced derived structs with nested object", () => {
  expect(JSON.stringify(JSON.parse<Namespace.DerivedObjectWithNestedObject>(`{"a":"foo","b":"bar","c":{"value":"baz"}}`))).toBe(`{"a":"foo","b":"bar","c":{"value":"baz"}}`);
  expect(JSON.stringify(JSON.parse<Namespace.DerivedObjectWithNestedObject>(`{"c":{"value":"baz"},"a":"foo","b":"bar"}`))).toBe(`{"a":"foo","b":"bar","c":{"value":"baz"}}`);
});

type NumberAlias = i64;

namespace Namespace {

  @json
  export class Base {
    a: string = "";
  }


  @json
  export class Bar {
    value: string = "";
  }


  @json
  export class ObjectWithAliasProperty {
    a: string = "";
    value: NumberAlias = 0;
  }


  @json
  export class DerivedObject extends Base {
    b: string = "";
  }


  @json
  export class DerivedObjectWithNestedObject extends Base {
    b: string = "";
    c: Bar = new Bar();
  }
}

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should serialize namespaced alias property", () => {
  const x = new Namespace.ObjectWithAliasProperty();
  x.a = "hello";
  x.value = 42;
  expect(JSON.stringify(x)).toBe('{"a":"hello","value":42}');
});

describe("Should deserialize namespaced alias property", () => {
  const x = JSON.parse<Namespace.ObjectWithAliasProperty>('{"a":"hello","value":42}');
  expect(x.a).toBe("hello");
  expect(x.value.toString()).toBe("42");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
