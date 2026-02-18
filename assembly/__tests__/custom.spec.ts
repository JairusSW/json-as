import { JSON } from "..";
import { describe, expect } from "./lib";
import { bytes } from "../util";


@json
class Point {
  x: f64 = 0.0;
  y: f64 = 0.0;
  constructor(x: f64, y: f64) {
    this.x = x;
    this.y = y;
  }


  @serializer
  serializer(self: Point): string {
    return `(${self.x},${self.y})`;
  }


  @deserializer
  deserializer(data: string): Point {
    const dataSize = bytes(data);
    if (dataSize <= 2)
      throw new Error("Could not deserialize provided data as type Point");

    const c = data.indexOf(",");
    const x = data.slice(1, c);
    const y = data.slice(c + 1, data.length - 1);

    return new Point(f64.parse(x), f64.parse(y));
  }
}


@json
class ObjectWithCustom {
  value: Point = new Point(0, 0);
  constructor(value: Point) {
    this.value = value;
  }
}

describe("Should serialize using custom serializers", () => {
  expect(JSON.stringify<Point>(new Point(1, 2))).toBe("(1.0,2.0)");
});

describe("Should deserialize using custom deserializers", () => {
  const p1 = JSON.parse<Point>("(1.0,2.0)");
  expect(p1.x.toString()).toBe("1.0");
  expect(p1.y.toString()).toBe("2.0");
});

describe("Should serialize and deserialize using nested custom serializers", () => {
  expect(
    JSON.stringify<ObjectWithCustom>(new ObjectWithCustom(new Point(1, 2))),
  ).toBe(`{"value":(1.0,2.0)}`);
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

describe("Should deserialize additional custom points", () => {
  const p1 = JSON.parse<Point>("(-10.5,22.25)");
  expect(p1.x.toString()).toBe("-10.5");
  expect(p1.y.toString()).toBe("22.25");
});

describe("Should deserialize custom points with zero and negative values", () => {
  const parsed = JSON.parse<Point>("(0.0,-3.0)");
  expect(parsed.x.toString()).toBe("0.0");
  expect(parsed.y.toString()).toBe("-3.0");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
