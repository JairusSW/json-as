import { JSON } from "..";
import { describe, expect } from "./lib";


@json
class GenericTest<T> {
  public foo: T;

  constructor(foo: T) {
    this.foo = foo;
  }
}


@json
class Vec3 {
  public x!: i32;
  public y!: i32;
  public z!: i32;
}

describe("Should serialize generics", () => {
  expect(JSON.stringify(new GenericTest<string>("bar"))).toBe('{"foo":"bar"}');
  expect(JSON.stringify(new GenericTest<i32>(42))).toBe('{"foo":42}');
  expect(JSON.stringify(new GenericTest<boolean>(true))).toBe('{"foo":true}');
  expect(JSON.stringify(new GenericTest<Vec3>({ x: 1, y: 2, z: 3 }))).toBe(
    '{"foo":{"x":1,"y":2,"z":3}}',
  );
  expect(JSON.stringify(new GenericTest<string[]>(["item1", "item2"]))).toBe(
    '{"foo":["item1","item2"]}',
  );
  expect(
    JSON.stringify(
      new GenericTest<Vec3[]>([
        { x: 1, y: 2, z: 3 },
        { x: 4, y: 5, z: 6 },
      ]),
    ),
  ).toBe('{"foo":[{"x":1,"y":2,"z":3},{"x":4,"y":5,"z":6}]}');
  expect(JSON.stringify(new GenericTest<i32[]>([1, 2, 3]))).toBe(
    '{"foo":[1,2,3]}',
  );
  expect(JSON.stringify(new GenericTest<boolean[]>([true, false, true]))).toBe(
    '{"foo":[true,false,true]}',
  );
});

describe("Should deserialize generics", () => {
  expect(JSON.parse<GenericTest<string>>('{"foo":"bar"}').foo).toBe("bar");
  expect(JSON.parse<GenericTest<i32>>('{"foo":42}').foo.toString()).toBe("42");
  expect(JSON.parse<GenericTest<boolean>>('{"foo":true}').foo).toBe(true);
  expect(
    JSON.stringify(
      JSON.parse<GenericTest<Vec3>>('{"foo":{"x":1,"y":2,"z":3}}'),
    ),
  ).toBe('{"foo":{"x":1,"y":2,"z":3}}');
  expect(
    JSON.stringify(
      JSON.parse<GenericTest<string[]>>('{"foo":["item1","item2"]}'),
    ),
  ).toBe('{"foo":["item1","item2"]}');
  expect(
    JSON.stringify(
      JSON.parse<GenericTest<Vec3[]>>(
        '{"foo":[{"x":1,"y":2,"z":3},{"x":4,"y":5,"z":6}]}',
      ),
    ),
  ).toBe('{"foo":[{"x":1,"y":2,"z":3},{"x":4,"y":5,"z":6}]}');
  expect(
    JSON.stringify(JSON.parse<GenericTest<i32[]>>('{"foo":[1,2,3]}')),
  ).toBe('{"foo":[1,2,3]}');
  expect(
    JSON.stringify(
      JSON.parse<GenericTest<boolean[]>>('{"foo":[true,false,true]}'),
    ),
  ).toBe('{"foo":[true,false,true]}');
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

describe("Should serialize nested generic wrappers", () => {
  const nested = new GenericTest<GenericTest<i32>>(new GenericTest<i32>(7));
  expect(JSON.stringify(nested)).toBe('{"foo":{"foo":7}}');
});

describe("Should deserialize nested generic wrappers", () => {
  const nested = JSON.parse<GenericTest<GenericTest<i32>>>('{"foo":{"foo":7}}');
  expect(nested.foo.foo.toString()).toBe("7");
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
