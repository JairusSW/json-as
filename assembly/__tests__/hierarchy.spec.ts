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
