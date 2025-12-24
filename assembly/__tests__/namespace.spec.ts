import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize namespaced derived structs", () => {
  const obj: Namespace.DerivedObject = { a: "foo", b: "bar" };
  expect(JSON.stringify(obj)).toBe(`{"a":"foo","b":"bar"}`);
});

describe("Should serialize namespaced derived structs with nested object", () => {
  const bar: Namespace.Bar = { value: "baz" };
  const obj: Namespace.DerivedObjectWithNestedObject = { a: "foo", b: "bar", c: bar };
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
