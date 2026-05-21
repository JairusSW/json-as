import { JSON } from "..";
import { describe, expect } from "as-test";

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
  ).toBe(
    '{"firstName":"Emmet","lastName":"West","lastActive":[8,27,2022],"age":23,"pos":{"x":3.4,"y":1.2,"z":8.3},"isVerified":true}',
  );

  expect(JSON.stringify<ObjectWithFloat>({ f: 7.23 })).toBe('{"f":7.23}');

  expect(JSON.stringify<ObjectWithFloat>({ f: 0.000001 })).toBe(
    '{"f":0.000001}',
  );

  expect(JSON.stringify<ObjectWithFloat>({ f: 1e-7 })).toBe('{"f":1e-7}');

  expect(JSON.stringify<ObjectWithFloat>({ f: 1e20 })).toBe(
    '{"f":100000000000000000000.0}',
  );

  expect(JSON.stringify<ObjectWithFloat>({ f: 1e21 })).toBe('{"f":1e+21}');

  expect(JSON.stringify<ObjWithStrangeKey<string>>({ data: "foo" })).toBe(
    '{"a\\\\\\t\\"\\u0002b`c":"foo"}',
  );
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
  expect(JSON.stringify(JSON.parse<Vec3>('{"x":3.4,"y":1.2,"z":8.3}'))).toBe(
    '{"x":3.4,"y":1.2,"z":8.3}',
  );
  expect(
    JSON.stringify(JSON.parse<Vec3>('{"x":3.4,"a":1.3,"y":1.2,"z":8.3}')),
  ).toBe('{"x":3.4,"y":1.2,"z":8.3}');
  expect(
    JSON.stringify(
      JSON.parse<Vec3>(
        '{"x":3.4,"a":1.3,"y":123,"asdf":3453204,"boink":[],"y":1.2,"z":8.3}',
      ),
    ),
  ).toBe('{"x":3.4,"y":1.2,"z":8.3}');
});

describe("Should deserialize structs with whitespace", () => {
  expect(
    JSON.stringify(
      JSON.parse<Vec3>(
        '    {  "x"  :  3.4  ,  "y"  :  1.2    ,  "z"   :  8.3   }   ',
      ),
    ),
  ).toBe('{"x":3.4,"y":1.2,"z":8.3}');
});

describe("Should deserialize structs with nullable properties", () => {
  expect(
    JSON.stringify(JSON.parse<NullableObj>('{"bar":{"value":"test"}}')),
  ).toBe('{"bar":{"value":"test"}}');

  expect(JSON.stringify(JSON.parse<NullableObj>('{"bar":null}'))).toBe(
    '{"bar":null}',
  );
});

describe("Should deserialize structs with nullable arrays in properties", () => {
  expect(
    JSON.stringify(JSON.parse<NullableArrayObj>('{"bars":[{"value":"test"}]}')),
  ).toBe('{"bars":[{"value":"test"}]}');

  expect(JSON.stringify(JSON.parse<NullableArrayObj>('{"bars":null}'))).toBe(
    '{"bars":null}',
  );
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


@json
class ObjectArrayFieldHolder {
  items: JSON.Obj[] = [];
}


@json
class ValueArrayFieldHolder {
  items: JSON.Value[] = [];
}


@json
class RawArrayFieldHolder {
  items: JSON.Raw[] = [];
}


@json
class MapArrayFieldHolder {
  items: Map<string, i32>[] = [];
}


@json
class BoxArrayFieldHolder {
  items: JSON.Box<i32>[] = [];
}

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

describe("Should deserialize player structs with null nested object", () => {
  const p = JSON.parse<Player>(
    '{"firstName":"A","lastName":"B","lastActive":[1,2,3],"age":10,"pos":null,"isVerified":false}',
  );
  expect(p.firstName).toBe("A");
  expect((p.pos == null).toString()).toBe("true");
  expect(p.isVerified.toString()).toBe("false");
});

describe("Should apply omitif and omitnull behavior across values", () => {
  const a = new OmitIf();
  a.y = -1;
  expect(JSON.stringify(a)).toBe('{"x":1,"z":1}');

  const b = new OmitIf();
  b.y = 7;
  b.foo = "ok";
  expect(JSON.stringify(b)).toBe('{"y":7,"foo":"ok","x":1,"z":1}');
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

describe("Should round-trip Box<T> | null fields for every primitive", () => {
  const allValues = JSON.parse<NullableBoxFields>(
    '{"i":12,"u":34,"f":1.5,"b":true,"s":"hi"}',
  );
  expect(allValues.i!.value.toString()).toBe("12");
  expect(allValues.u!.value.toString()).toBe("34");
  expect(allValues.f!.value.toString()).toBe("1.5");
  expect(allValues.b!.value.toString()).toBe("true");
  expect(allValues.s).toBe("hi");
  expect(JSON.stringify(allValues)).toBe(
    '{"i":12,"u":34,"f":1.5,"b":true,"s":"hi"}',
  );

  const allNulls = JSON.parse<NullableBoxFields>(
    '{"i":null,"u":null,"f":null,"b":null,"s":null}',
  );
  expect((allNulls.i == null).toString()).toBe("true");
  expect((allNulls.u == null).toString()).toBe("true");
  expect((allNulls.f == null).toString()).toBe("true");
  expect((allNulls.b == null).toString()).toBe("true");
  expect((allNulls.s == null).toString()).toBe("true");
  expect(JSON.stringify(allNulls)).toBe(
    '{"i":null,"u":null,"f":null,"b":null,"s":null}',
  );
});

describe("Should round-trip T | null fields for non-primitive types", () => {
  const filled = JSON.parse<NullableNonPrimFields>(
    '{"text":"abc","vec":{"x":1.0,"y":2.0,"z":3.0},"d":"2025-02-03T21:28:40.525Z"}',
  );
  expect(filled.text).toBe("abc");
  expect((filled.vec == null).toString()).toBe("false");
  expect(filled.vec!.x.toString()).toBe("1.0");
  expect((filled.d == null).toString()).toBe("false");
  expect(filled.d!.getUTCMilliseconds()).toBe(525);

  const empty = JSON.parse<NullableNonPrimFields>(
    '{"text":null,"vec":null,"d":null}',
  );
  expect((empty.text == null).toString()).toBe("true");
  expect((empty.vec == null).toString()).toBe("true");
  expect((empty.d == null).toString()).toBe("true");
  expect(JSON.stringify(empty)).toBe('{"text":null,"vec":null,"d":null}');
});


@json
class NullableBoxFields {
  i: JSON.Box<i32> | null = null;
  u: JSON.Box<u64> | null = null;
  f: JSON.Box<f64> | null = null;
  b: JSON.Box<bool> | null = null;
  s: string | null = null;
}


@json
class NullableNonPrimFields {
  text: string | null = null;
  vec: Vec3 | null = null;
  d: Date | null = null;
}

describe("Should round-trip nested nullable @json classes", () => {
  // Outer class has nullable inner, inner class has its own nullable fields.
  const both = JSON.parse<NullableOuter>(
    '{"inner":{"label":"hello","tail":{"label":"world","tail":null}}}',
  );
  expect((both.inner == null).toString()).toBe("false");
  expect(both.inner!.label).toBe("hello");
  expect((both.inner!.tail == null).toString()).toBe("false");
  expect(both.inner!.tail!.label).toBe("world");
  expect((both.inner!.tail!.tail == null).toString()).toBe("true");
  expect(JSON.stringify(both)).toBe(
    '{"inner":{"label":"hello","tail":{"label":"world","tail":null}}}',
  );

  const outerNull = JSON.parse<NullableOuter>('{"inner":null}');
  expect((outerNull.inner == null).toString()).toBe("true");
  expect(JSON.stringify(outerNull)).toBe('{"inner":null}');

  const innerLabelNull = JSON.parse<NullableOuter>(
    '{"inner":{"label":null,"tail":null}}',
  );
  expect((innerLabelNull.inner == null).toString()).toBe("false");
  expect((innerLabelNull.inner!.label == null).toString()).toBe("true");
  expect((innerLabelNull.inner!.tail == null).toString()).toBe("true");
});

describe("Should round-trip a struct mixing every nullable shape side-by-side", () => {
  const full = JSON.parse<MixedNullable>(
    '{"name":"Alice","age":30,"vec":{"x":1.0,"y":2.0,"z":3.0},"tags":["a","b"],"score":99.5,"flag":true}',
  );
  expect(full.name).toBe("Alice");
  expect(full.age!.value.toString()).toBe("30");
  expect(full.vec!.x.toString()).toBe("1.0");
  expect(full.tags!.length).toBe(2);
  expect(full.score!.value.toString()).toBe("99.5");
  expect(full.flag!.value.toString()).toBe("true");

  const empty = JSON.parse<MixedNullable>(
    '{"name":null,"age":null,"vec":null,"tags":null,"score":null,"flag":null}',
  );
  expect((empty.name == null).toString()).toBe("true");
  expect((empty.age == null).toString()).toBe("true");
  expect((empty.vec == null).toString()).toBe("true");
  expect((empty.tags == null).toString()).toBe("true");
  expect((empty.score == null).toString()).toBe("true");
  expect((empty.flag == null).toString()).toBe("true");
  expect(JSON.stringify(empty)).toBe(
    '{"name":null,"age":null,"vec":null,"tags":null,"score":null,"flag":null}',
  );
});


@json
class NullableInner {
  label: string | null = null;
  tail: NullableInner | null = null;
}


@json
class NullableOuter {
  inner: NullableInner | null = null;
}


@json
class MixedNullable {
  name: string | null = null;
  age: JSON.Box<i32> | null = null;
  vec: Vec3 | null = null;
  tags: string[] | null = null;
  score: JSON.Box<f64> | null = null;
  flag: JSON.Box<bool> | null = null;
}

describe("Should keep naive string scratch space bounded across repeated large struct parses", () => {
  const payload = buildStringHeavyPayload();

  for (let i = 0; i < 256; i++) {
    const parsed = JSON.parse<StringHeavyPayload>(payload);
    expect(parsed.title.length).toBe(704);
    expect(parsed.repo.length).toBe(608);
    expect(parsed.summary.length).toBe(704);
    expect(parsed.footer.length).toBe(384);
  }
});

describe("Should deserialize nested string array fields", () => {
  const input = '{"matrix":[[],["x"],["y","z"]]}';
  const parsed = JSON.parse<MatrixHolder>(input);
  expect(parsed.matrix.length).toBe(3);
  expect(parsed.matrix[0].length).toBe(0);
  expect(parsed.matrix[1].length).toBe(1);
  expect(parsed.matrix[1][0]).toBe("x");
  expect(parsed.matrix[2].length).toBe(2);
  expect(parsed.matrix[2][0]).toBe("y");
  expect(parsed.matrix[2][1]).toBe("z");
  expect(JSON.stringify(parsed)).toBe(input);

  const spaced = JSON.parse<MatrixHolder>(
    ' { "matrix" : [ [ ] , [ "x" ] , [ "y" , "z" ] ] } ',
  );
  expect(spaced.matrix.length).toBe(3);
  expect(spaced.matrix[2][1]).toBe("z");

  const varied = JSON.parse<MatrixHolder>(
    '{"matrix":[["left","right"],[],["tail"]]}',
  );
  expect(varied.matrix.length).toBe(3);
  expect(varied.matrix[0].length).toBe(2);
  expect(varied.matrix[0][1]).toBe("right");
  expect(varied.matrix[1].length).toBe(0);
  expect(varied.matrix[2][0]).toBe("tail");
});

describe("Should deserialize struct array fields", () => {
  const input =
    '{"items":[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]}';
  const parsed = JSON.parse<Vec3ArrayHolder>(input);
  expect(parsed.items.length).toBe(2);
  expect(parsed.items[0].x.toString()).toBe("1.0");
  expect(parsed.items[0].y.toString()).toBe("2.0");
  expect(parsed.items[1].z.toString()).toBe("6.0");
  expect(JSON.stringify(parsed)).toBe(input);

  const empty = JSON.parse<Vec3ArrayHolder>('{"items":[]}');
  expect(empty.items.length).toBe(0);
  expect(JSON.stringify(empty)).toBe('{"items":[]}');

  const spaced = JSON.parse<Vec3ArrayHolder>(
    ' { "items" : [ { "x" : 1.0 , "y" : 2.0 , "z" : 3.0 } , { "x" : 4.0 , "y" : 5.0 , "z" : 6.0 } ] } ',
  );
  expect(spaced.items.length).toBe(2);
  expect(spaced.items[1].y.toString()).toBe("5.0");
});

describe("Should deserialize nullable string array fields", () => {
  const parsed = JSON.parse<NullableStringArrayHolder>(
    '{"items":[null,"x",null,"y"]}',
  );
  expect(parsed.items.length).toBe(4);
  expect((parsed.items[0] == null).toString()).toBe("true");
  expect(parsed.items[1]).toBe("x");
  expect((parsed.items[2] == null).toString()).toBe("true");
  expect(parsed.items[3]).toBe("y");

  const spaced = JSON.parse<NullableStringArrayHolder>(
    ' { "items" : [ null , "left" , null , "right" ] } ',
  );
  expect(spaced.items.length).toBe(4);
  expect(spaced.items[1]).toBe("left");
  expect(spaced.items[3]).toBe("right");
});

describe("Should deserialize object, arbitrary, raw, map, and box array fields", () => {
  const objs = JSON.parse<ObjectArrayFieldHolder>(
    '{"items":[{"kind":"a","meta":{"x":1}},{"kind":"b","list":[1,2]}]}',
  );
  expect(objs.items.length).toBe(2);
  expect(objs.items[0].get("kind")!.get<string>()).toBe("a");
  expect(objs.items[1].get("list")!.get<JSON.Value[]>()[1].toString()).toBe(
    "2.0",
  );
  expect(JSON.stringify(objs)).toBe(
    '{"items":[{"kind":"a","meta":{"x":1.0}},{"kind":"b","list":[1.0,2.0]}]}',
  );

  const values = JSON.parse<ValueArrayFieldHolder>(
    '{"items":[1,true,"x",{"k":2},[3,4],null]}',
  );
  expect(values.items.length).toBe(6);
  expect(values.items[0].toString()).toBe("1.0");
  expect(values.items[1].toString()).toBe("true");
  expect(values.items[2].get<string>()).toBe("x");
  expect(values.items[3].get<JSON.Obj>().get("k")!.toString()).toBe("2.0");
  expect(values.items[4].get<JSON.Value[]>()[1].toString()).toBe("4.0");
  expect(values.items[5].toString()).toBe("null");

  const raws = JSON.parse<RawArrayFieldHolder>(
    '{"items":[{"x":1},[1,2],"abc",false]}',
  );
  expect(raws.items.length).toBe(4);
  expect(raws.items[0].toString()).toBe('{"x":1}');
  expect(raws.items[1].toString()).toBe("[1,2]");
  expect(raws.items[2].toString()).toBe('"abc"');
  expect(raws.items[3].toString()).toBe("false");

  const maps = JSON.parse<MapArrayFieldHolder>(
    '{"items":[{"a":1},{"b":2,"c":3},{}]}',
  );
  expect(maps.items.length).toBe(3);
  expect(maps.items[0].get("a")).toBe(1);
  expect(maps.items[1].get("c")).toBe(3);
  expect(maps.items[2].size).toBe(0);
  expect(JSON.stringify(maps)).toBe('{"items":[{"a":1},{"b":2,"c":3},{}]}');

  const boxes = JSON.parse<BoxArrayFieldHolder>('{"items":[1,-2,3]}');
  expect(boxes.items.length).toBe(3);
  expect(boxes.items[0].value).toBe(1);
  expect(boxes.items[1].value).toBe(-2);
  expect(boxes.items[2].value).toBe(3);
  expect(JSON.stringify(boxes)).toBe('{"items":[1,-2,3]}');
});

describe("Should round-trip top-level Vec3 arrays through JSON.parse", () => {
  // Drives the SWAR struct-array helper through the top-level array
  // dispatcher (`deserializeStructArray`) in SWAR/SIMD modes and the
  // simple variant in NAIVE.
  const parsed = JSON.parse<Vec3[]>(
    '[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]',
  );
  expect(parsed.length).toBe(2);
  expect(parsed[0].x).toBe(1.0);
  expect(parsed[1].z).toBe(6.0);

  const empty = JSON.parse<Vec3[]>("[]");
  expect(empty.length).toBe(0);
});

describe("Should round-trip JSON.Obj arrays through JSON.parse", () => {
  // Drives the JSON.Obj array body's empty-bracket short-circuit
  // and its populated-loop branch via the top-level array dispatcher.
  expect(JSON.parse<JSON.Obj[]>("[]").length).toBe(0);

  const objs = JSON.parse<JSON.Obj[]>('[{"kind":"a"},{"kind":"b"}]');
  expect(objs.length).toBe(2);
  expect(objs[0].get("kind")!.get<string>()).toBe("a");
  expect(objs[1].get("kind")!.get<string>()).toBe("b");
});

describe("Should round-trip nested numeric arrays through JSON.parse", () => {
  // Drives the nested-array body for f64[][], i32[][], and string[][]
  // through the top-level dispatcher.
  const floats = JSON.parse<f64[][]>("[[1.5],[-2.25,3.125],[]]");
  expect(floats.length).toBe(3);
  expect(floats[0][0]).toBe(1.5);
  expect(floats[1][1]).toBe(3.125);
  expect(floats[2].length).toBe(0);

  const ints = JSON.parse<i32[][]>("[[1,2],[3],[]]");
  expect(ints.length).toBe(3);
  expect(ints[0][0]).toBe(1);
  expect(ints[0][1]).toBe(2);
  expect(ints[1][0]).toBe(3);
  expect(ints[2].length).toBe(0);

  const strings = JSON.parse<string[][]>('[["x"],["y","z"],[]]');
  expect(strings.length).toBe(3);
  expect(strings[0][0]).toBe("x");
  expect(strings[1][1]).toBe("z");
  expect(strings[2].length).toBe(0);

  expect(JSON.parse<i32[][]>("[]").length).toBe(0);
});

function repeatChunk(chunk: string, count: i32): string {
  let out = "";
  for (let i = 0; i < count; i++) out += chunk;
  return out;
}

function buildStringHeavyPayload(): string {
  const title = repeatChunk("alpha-beta-", 64);
  const repo = repeatChunk("octocat/repository/", 32);
  const summary = repeatChunk("payload-segment-", 44);
  const footer = repeatChunk("final-block-", 32);

  return (
    '{"title":"' +
    title +
    '","repo":"' +
    repo +
    '","summary":"' +
    summary +
    '","footer":"' +
    footer +
    '"}'
  );
}


@json
class StringHeavyPayload {
  title: string = "";
  repo: string = "";
  summary: string = "";
  footer: string = "";
}


@json
class MatrixHolder {
  matrix: string[][] = [];
}


@json
class Vec3ArrayHolder {
  items: Vec3[] = [];
}


@json
class NullableStringArrayHolder {
  items: Array<string | null> = [];
}
