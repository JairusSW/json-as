import { JSON } from "..";
import { describe, expect } from "as-test";

type StringAlias = string;
type StringAlias1 = StringAlias;
type StringAlias2 = StringAlias1;
type StringAlias3 = StringAlias2;
type StringAlias4 = StringAlias3;


@json
class Alias {
  public foo: StringAlias4 = "";
  constructor(foo: StringAlias2) {
    this.foo = foo;
  }
}

const alias = new Alias("bar");

describe("Should serialize with type aliases", () => {
  expect(JSON.stringify(alias)).toBe('{"foo":"bar"}');
});

describe("Should deserialize with type aliases", () => {
  expect(JSON.stringify(JSON.parse<Alias>('{"foo":"bar"}'))).toBe('{"foo":"bar"}');
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should handle additional alias instances", () => {
  expect(JSON.stringify(new Alias(""))).toBe('{"foo":""}');
  expect(JSON.stringify(new Alias("symbols-!@#"))).toBe('{"foo":"symbols-!@#"}');
});

describe("Should deserialize additional alias payloads", () => {
  expect(JSON.parse<Alias>('{"foo":""}').foo).toBe("");
  expect(JSON.parse<Alias>('{"foo":"multi word value"}').foo).toBe("multi word value");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
