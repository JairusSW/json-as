import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize structs", () => {
  expect(
    JSON.stringify<Vec3>({
      x: 3.4,
      y: 1.2,
      z: 8.3,
    }),
  ).toBe('{"x":3.4,"y":1.2,"z":8.3}');

  expect(
    JSON.stringify<Player>({
      firstName: "Emmet",
      lastName: "West",
      lastActive: [8, 27, 2022],
      age: 23,
      pos: {
        x: 3.4,
        y: 1.2,
        z: 8.3,
      },
      isVerified: true,
    }),
  ).toBe('{"firstName":"Emmet","lastName":"West","lastActive":[8,27,2022],"age":23,"pos":{"x":3.4,"y":1.2,"z":8.3},"isVerified":true}');

  expect(JSON.stringify<ObjectWithFloat>({ f: 7.23 })).toBe('{"f":7.23}');

  expect(JSON.stringify<ObjectWithFloat>({ f: 0.000001 })).toBe('{"f":0.000001}');

  expect(JSON.stringify<ObjectWithFloat>({ f: 1e-7 })).toBe('{"f":1e-7}');

  expect(JSON.stringify<ObjectWithFloat>({ f: 1e20 })).toBe('{"f":100000000000000000000.0}');

  expect(JSON.stringify<ObjectWithFloat>({ f: 1e21 })).toBe('{"f":1e+21}');

  expect(JSON.stringify<ObjWithStrangeKey<string>>({ data: "foo" })).toBe('{"a\\\\\\t\\"\\u0002b`c":"foo"}');
});

describe("Should serialize structs with inheritance", () => {
  const obj = new DerivedObject("1", "2");

  expect(JSON.stringify(obj)).toBe('{"a":"1","b":"2"}');
});

describe("Should ignore properties decorated with @omit", () => {
  expect(
    JSON.stringify(<OmitIf>{
      y: 1,
    }),
  ).toBe('{"y":1,"x":1,"z":1}');
});

describe("Should deserialize structs", () => {
  expect(JSON.stringify(JSON.parse<Vec3>('{"x":3.4,"y":1.2,"z":8.3}'))).toBe('{"x":3.4,"y":1.2,"z":8.3}');
  expect(JSON.stringify(JSON.parse<Vec3>('{"x":3.4,"a":1.3,"y":1.2,"z":8.3}'))).toBe('{"x":3.4,"y":1.2,"z":8.3}');
  expect(JSON.stringify(JSON.parse<Vec3>('{"x":3.4,"a":1.3,"y":123,"asdf":3453204,"boink":[],"y":1.2,"z":8.3}'))).toBe('{"x":3.4,"y":1.2,"z":8.3}');
});

describe("Should deserialize structs with whitespace", () => {
  expect(JSON.stringify(JSON.parse<Vec3>('    {  "x"  :  3.4  ,  "y"  :  1.2    ,  "z"   :  8.3   }   '))).toBe('{"x":3.4,"y":1.2,"z":8.3}');
});

describe("Should deserialize structs with nullable properties", () => {
  expect(JSON.stringify(JSON.parse<NullableObj>('{"bar":{"value":"test"}}'))).toBe('{"bar":{"value":"test"}}');

  expect(JSON.stringify(JSON.parse<NullableObj>('{"bar":null}'))).toBe('{"bar":null}');
});

describe("Should deserialize structs with nullable arrays in properties", () => {
  expect(JSON.stringify(JSON.parse<NullableArrayObj>('{"bars":[{"value":"test"}]}'))).toBe('{"bars":[{"value":"test"}]}');

  expect(JSON.stringify(JSON.parse<NullableArrayObj>('{"bars":null}'))).toBe('{"bars":null}');
});

// describe("Should serialize Suite struct", () => {

// });

@json
class BaseObject {
  a: string;
  constructor(a: string) {
    this.a = a;
  }
}


@json
class DerivedObject extends BaseObject {
  b: string;
  constructor(a: string, b: string) {
    super(a);
    this.b = b;
  }
}


@json
class Vec3 {
  x: f64 = 0.0;
  y: f64 = 0.0;
  z: f64 = 0.0;
}


@json
class Player {
  firstName!: string;
  lastName!: string;
  lastActive!: i32[];
  age!: i32;
  pos!: Vec3 | null;
  isVerified!: boolean;
}


@json
class ObjWithStrangeKey<T> {

  @alias('a\\\t"\x02b`c')
  data!: T;
}


@json
class ObjectWithFloat {
  f!: f64;
}


@json
class OmitIf {
  x: i32 = 1;


  @omitif("this.y == -1")
  y: i32 = -1;
  z: i32 = 1;


  @omitnull()
  foo: string | null = null;
}


@json
class NullableObj {
  bar: Bar | null = null;
}


@json
class NullableArrayObj {
  bars: Bar[] | null = null;
}


@json
class Bar {
  value: string = "";
}
