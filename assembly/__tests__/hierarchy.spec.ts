import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { JSON } from "..";
import { describe, expect } from "./lib";


@json
class Foo {
  a: i32 = 0;
}


@json
class Bar extends Foo {
  b: i32 = 0;


  @serializer
  serialize(self: Bar): string {
    return `"bar"`;
  }


  @deserializer
  deserialize(data: string): Bar {
    return data == '"bar"'
      ? {
          a: 1,
          b: 2,
        }
      : new Bar();
  }
}

describe("should use custom serializer for subclasses", () => {
  const bar = new Bar();
  bar.a = 1;
  bar.b = 2;
  const data = JSON.stringify(bar);
  expect(data).toBe('"bar"');
});

describe("should use custom serializer for subclasses when type is the parent", () => {
  const bar = new Bar();
  bar.a = 1;
  bar.b = 2;
  const data = JSON.stringify<Foo>(bar);
  expect(data).toBe('"bar"');
});

describe("should use custom deserializer for subclass", () => {
  const json = '"bar"';
  const bar = JSON.parse<Bar>(json);
  expect(bar.a.toString()).toBe("1");
  expect(bar.b.toString()).toBe("2");
});

describe("should use custom deserializer even when type is the parent", () => {
  const json = '"bar"';
  const foo = JSON.parse<Bar>(json);
  expect(foo.a.toString()).toBe("1");
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe(
    '"regression"',
  );
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe(
    '["a","b","c"]',
  );
});

describe("should return default subclass value on unmatched custom payload", () => {
  const bar = JSON.parse<Bar>('"not-bar"');
  expect(bar.a.toString()).toBe("0");
  expect(bar.b.toString()).toBe("0");
});

describe("should keep base behavior for plain base object", () => {
  const foo = new Foo();
  foo.a = 99;
  expect(JSON.stringify(foo)).toBe('{"a":99}');
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe(
    "[[1],[2,3],[]]",
  );
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe(
    '"line\\nbreak"',
  );
});
