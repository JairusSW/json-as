import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class Point {
  x: f64 = 0.0;
  y: f64 = 0.0;
  constructor(x: f64, y: f64) {
    this.x = x;
    this.y = y;
  }


  @serializer("string")
  serializer(self: Point): string {
    return JSON.stringify(`${self.x},${self.y}`);
  }


  @deserializer("string")
  deserializer(data: string): Point {
    const raw = JSON.parse<string>(data);
    if (!raw.length) throw new Error("Could not deserialize provided data as type Point");

    const c = raw.indexOf(",");
    const x = raw.slice(0, c);
    const y = raw.slice(c + 1);

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


@json
class NullableCustomBox {
  value: Point | null = null;
}


@json
class DualCustom {
  left: Point = new Point(0, 0);
  right: Point = new Point(0, 0);
}

describe("Should serialize using custom serializers", () => {
  expect(JSON.stringify<Point>(new Point(1, 2))).toBe('"1.0,2.0"');
});

describe("Should deserialize using custom deserializers", () => {
  const p1 = JSON.parse<Point>('"1.0,2.0"');
  expect(p1.x.toString()).toBe("1.0");
  expect(p1.y.toString()).toBe("2.0");
});

describe("Should serialize and deserialize using nested custom serializers", () => {
  expect(JSON.stringify<ObjectWithCustom>(new ObjectWithCustom(new Point(1, 2)))).toBe('{"value":"1.0,2.0"}');
});

describe("Should deserialize nullable custom fields from null", () => {
  const parsed = JSON.parse<NullableCustomBox>('{"value":null}');
  expect((parsed.value == null).toString()).toBe("true");
  expect(JSON.stringify(parsed)).toBe('{"value":null}');
});

describe("Should deserialize nullable custom fields from values", () => {
  const parsed = JSON.parse<NullableCustomBox>('{"value":"4.0,-2.5"}');
  expect((parsed.value == null).toString()).toBe("false");
  expect(parsed.value!.x.toString()).toBe("4.0");
  expect(parsed.value!.y.toString()).toBe("-2.5");
  expect(JSON.stringify(parsed)).toBe('{"value":"4.0,-2.5"}');
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should deserialize additional custom points", () => {
  const p1 = JSON.parse<Point>('" -10.5,22.25"');
  expect(p1.x.toString()).toBe("-10.5");
  expect(p1.y.toString()).toBe("22.25");
});

describe("Should deserialize custom points with zero and negative values", () => {
  const parsed = JSON.parse<Point>('"0.0,-3.0"');
  expect(parsed.x.toString()).toBe("0.0");
  expect(parsed.y.toString()).toBe("-3.0");
});

describe("Should round-trip a broader custom point matrix", () => {
  expect(JSON.stringify(JSON.parse<Point>('"12.5,0.25"'))).toBe('"12.5,0.25"');
  expect(JSON.stringify(JSON.parse<Point>('"-0.5,-0.25"'))).toBe('"-0.5,-0.25"');
  expect(JSON.stringify(JSON.parse<Point>('"1000.0,-999.75"'))).toBe('"1000.0,-999.75"');
});

describe("Should preserve escaped content inside string-backed custom values", () => {
  const parsed = JSON.parse<Point>('"1.5,\\n2.25"');
  expect(parsed.x.toString()).toBe("1.5");
  expect(parsed.y.toString()).toBe("2.25");
  expect(JSON.stringify(parsed)).toBe('"1.5,2.25"');
});

describe("Should serialize and deserialize nested custom containers repeatedly", () => {
  const obj = new ObjectWithCustom(new Point(-3.25, 19.75));
  expect(JSON.stringify(obj)).toBe('{"value":"-3.25,19.75"}');
});

describe("Should deserialize multiple custom fields in one object", () => {
  const parsed = JSON.parse<DualCustom>('{"left":"1.0,2.0","right":"-3.0,4.5"}');
  expect(parsed.left.x.toString()).toBe("1.0");
  expect(parsed.left.y.toString()).toBe("2.0");
  expect(parsed.right.x.toString()).toBe("-3.0");
  expect(parsed.right.y.toString()).toBe("4.5");
  expect(JSON.stringify(parsed)).toBe('{"left":"1.0,2.0","right":"-3.0,4.5"}');
});

describe("Should deserialize nested custom fields with surrounding object whitespace", () => {
  const parsed = JSON.parse<ObjectWithCustom>('{  "value"  :  " -7.5 , 11.25 "  }');
  expect(parsed.value.x.toString()).toBe("-7.5");
  expect(parsed.value.y.toString()).toBe("11.25");
  expect(JSON.stringify(parsed)).toBe('{"value":"-7.5,11.25"}');
});

describe("Should preserve custom values through repeated parse and stringify cycles", () => {
  let encoded = '"8.5,-9.25"';
  for (let i = 0; i < 6; i++) {
    encoded = JSON.stringify(JSON.parse<Point>(encoded));
  }
  expect(encoded).toBe('"8.5,-9.25"');
});

describe("Should preserve nested custom values through repeated parse and stringify cycles", () => {
  let encoded = '{"value":"-12.0,0.75"}';
  for (let i = 0; i < 6; i++) {
    encoded = JSON.stringify(JSON.parse<ObjectWithCustom>(encoded));
  }
  expect(encoded).toBe('{"value":"-12.0,0.75"}');
});

describe("Should preserve custom values through JSON.internal helpers", () => {
  const encoded = JSON.internal.stringify<Point>(new Point(6.25, -7.5));
  expect(encoded).toBe('"6.25,-7.5"');
  const parsed = JSON.internal.parse<Point>(encoded);
  expect(parsed.x.toString()).toBe("6.25");
  expect(parsed.y.toString()).toBe("-7.5");
});

describe("Should preserve nested custom values through JSON.internal helpers", () => {
  const encoded = JSON.internal.stringify<ObjectWithCustom>(new ObjectWithCustom(new Point(9.5, -1.25)));
  expect(encoded).toBe('{"value":"9.5,-1.25"}');
  const parsed = JSON.internal.parse<ObjectWithCustom>(encoded);
  expect(parsed.value.x.toString()).toBe("9.5");
  expect(parsed.value.y.toString()).toBe("-1.25");
});

describe("Should deserialize custom values with tighter separators", () => {
  const parsed = JSON.parse<Point>('" -12.5 , 0.25 "');
  expect(parsed.x.toString()).toBe("-12.5");
  expect(parsed.y.toString()).toBe("0.25");
  expect(JSON.stringify(parsed)).toBe('"-12.5,0.25"');
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
