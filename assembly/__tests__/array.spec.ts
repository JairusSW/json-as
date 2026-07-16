import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Should serialize integer arrays", () => {
  expect(JSON.stringify<u32[]>([0, 100, 101])).toBe("[0,100,101]");

  expect(JSON.stringify<u64[]>([0, 100, 101])).toBe("[0,100,101]");

  expect(JSON.stringify<i32[]>([0, 100, 101, -100, -101])).toBe(
    "[0,100,101,-100,-101]",
  );

  expect(JSON.stringify<i64[]>([0, 100, 101, -100, -101])).toBe(
    "[0,100,101,-100,-101]",
  );

  expect(JSON.stringify<u32[]>([u32.MAX_VALUE])).toBe("[4294967295]");
  expect(JSON.stringify<i32[]>([i32.MIN_VALUE, i32.MAX_VALUE])).toBe(
    "[-2147483648,2147483647]",
  );
  expect(JSON.stringify<u64[]>([u64.MAX_VALUE])).toBe("[18446744073709551615]");
  expect(JSON.stringify<i64[]>([i64.MIN_VALUE, i64.MAX_VALUE])).toBe(
    "[-9223372036854775808,9223372036854775807]",
  );
});

describe("Should serialize float arrays", () => {
  expect(
    JSON.stringify<f64[]>([7.23, 10e2, 10e2, 123456e-5, 123456e-5, 0.0, 7.23]),
  ).toBe("[7.23,1000,1000,1.23456,1.23456,0,7.23]");

  expect(JSON.stringify<f64[]>([1e21, 1e22, 1e-7, 1e-8, 1e-9])).toBe(
    "[1e+21,1e+22,1e-7,1e-8,1e-9]",
  );

  expect(JSON.stringify<f32[]>([-1.5, 0.25, 3.75])).toBe("[-1.5,0.25,3.75]");
});

describe("Should serialize boolean arrays", () => {
  expect(JSON.stringify<bool[]>([true, false])).toBe("[true,false]");

  expect(JSON.stringify<boolean[]>([true, false])).toBe("[true,false]");
});

describe("Should serialize string arrays", () => {
  expect(
    JSON.stringify<string[]>([
      'string "with random spa\nces and \nnewlines\n\n\n',
    ]),
  ).toBe('["string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"]');
});

describe("Should serialize nested integer arrays", () => {
  expect(JSON.stringify<i64[][]>([[100, 101], [-100, -101], [0]])).toBe(
    "[[100,101],[-100,-101],[0]]",
  );
});

describe("Should serialize nested float arrays", () => {
  expect(
    JSON.stringify<f64[][]>([
      [7.23],
      [10e2],
      [10e2],
      [123456e-5],
      [123456e-5],
      [0.0],
      [7.23],
    ]),
  ).toBe("[[7.23],[1000],[1000],[1.23456],[1.23456],[0],[7.23]]");
});

describe("Should serialize nested boolean arrays", () => {
  expect(JSON.stringify<bool[][]>([[true], [false]])).toBe("[[true],[false]]");

  expect(JSON.stringify<boolean[][]>([[true], [false]])).toBe(
    "[[true],[false]]",
  );
});

describe("Should serialize object arrays", () => {
  expect(
    JSON.stringify<Vec3[]>([
      {
        x: 3.4,
        y: 1.2,
        z: 8.3,
      },
      {
        x: 3.4,
        y: -2.1,
        z: 9.3,
      },
    ]),
  ).toBe('[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]');
});

describe("Should deserialize integer arrays", () => {
  expect(JSON.stringify(JSON.parse<u32[]>("[0,100,101]"))).toBe("[0,100,101]");
  expect(JSON.stringify(JSON.parse<u64[]>("[0,100,101]"))).toBe("[0,100,101]");
  expect(JSON.stringify(JSON.parse<i32[]>("[0,100,101,-100,-101]"))).toBe(
    "[0,100,101,-100,-101]",
  );
  expect(JSON.stringify(JSON.parse<i64[]>("[0,100,101,-100,-101]"))).toBe(
    "[0,100,101,-100,-101]",
  );
});

describe("Should serialize and deserialize narrow integer arrays", () => {
  expect(JSON.stringify<u8[]>([0, 7, 255])).toBe("[0,7,255]");
  expect(JSON.stringify<i8[]>([-128, 0, 127])).toBe("[-128,0,127]");
  expect(JSON.stringify<u16[]>([0, 42, 65535])).toBe("[0,42,65535]");
  expect(JSON.stringify<i16[]>([-32768, 0, 32767])).toBe("[-32768,0,32767]");

  expect(JSON.stringify(JSON.parse<u8[]>("[0,7,255]"))).toBe("[0,7,255]");
  expect(JSON.stringify(JSON.parse<i8[]>("[-128,0,127]"))).toBe("[-128,0,127]");
  expect(JSON.stringify(JSON.parse<u16[]>("[0,42,65535]"))).toBe(
    "[0,42,65535]",
  );
  expect(JSON.stringify(JSON.parse<i16[]>("[-32768,0,32767]"))).toBe(
    "[-32768,0,32767]",
  );
});

describe("Should deserialize float arrays", () => {
  expect(
    JSON.stringify(
      JSON.parse<f64[]>("[7.23,1000,1000,1.23456,1.23456,0,7.23]"),
    ),
  ).toBe("[7.23,1000,1000,1.23456,1.23456,0,7.23]");
  expect(
    JSON.stringify(JSON.parse<f64[]>("[1e+21,1e+22,1e-7,1e-8,1e-9]")),
  ).toBe("[1e+21,1e+22,1e-7,1e-8,1e-9]");
  expect(JSON.stringify(JSON.parse<f32[]>("[-1.5,0.25,3.75]"))).toBe(
    "[-1.5,0.25,3.75]",
  );
});

describe("Should deserialize boolean arrays", () => {
  expect(JSON.stringify(JSON.parse<bool[]>("[true,false]"))).toBe(
    "[true,false]",
  );
  expect(JSON.stringify(JSON.parse<boolean[]>("[true,false]"))).toBe(
    "[true,false]",
  );
});

describe("Should deserialize string arrays", () => {
  expect(
    JSON.stringify(
      JSON.parse<string[]>(
        '["string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"]',
      ),
    ),
  ).toBe('["string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"]');
});

describe("Should deserialize nullable string arrays", () => {
  const parsed = JSON.parse<Array<string | null>>('[null,"x",null,"y"]');
  expect(parsed.length).toBe(4);
  expect((parsed[0] == null).toString()).toBe("true");
  expect(parsed[1]).toBe("x");
  expect((parsed[2] == null).toString()).toBe("true");
  expect(parsed[3]).toBe("y");

  const spaced = JSON.parse<Array<string | null>>(
    ' [ null , "left" , null , "right" ] ',
  );
  expect(spaced.length).toBe(4);
  expect(spaced[1]).toBe("left");
  expect(spaced[3]).toBe("right");
});

describe("Should serialize empty specialized arrays", () => {
  expect(JSON.stringify<u8[]>([])).toBe("[]");
  expect(JSON.stringify<i8[]>([])).toBe("[]");
  expect(JSON.stringify<f32[]>([])).toBe("[]");
  expect(JSON.stringify<bool[]>([])).toBe("[]");
});

describe("Should deserialize nested integer arrays", () => {
  expect(
    JSON.stringify(JSON.parse<i64[][]>("[[100,101],[-100,-101],[0]]")),
  ).toBe("[[100,101],[-100,-101],[0]]");
});

describe("Should deserialize nested float arrays", () => {
  expect(
    JSON.stringify(
      JSON.parse<f64[][]>(
        "[[7.23],[1000],[1000],[1.23456],[1.23456],[0],[7.23]]",
      ),
    ),
  ).toBe("[[7.23],[1000],[1000],[1.23456],[1.23456],[0],[7.23]]");
});

describe("Should deserialize nested boolean arrays", () => {
  expect(JSON.stringify(JSON.parse<bool[][]>("[[true],[false]]"))).toBe(
    "[[true],[false]]",
  );
  expect(JSON.stringify(JSON.parse<boolean[][]>("[[true],[false]]"))).toBe(
    "[[true],[false]]",
  );
});

describe("Should deserialize object arrays", () => {
  expect(
    JSON.stringify(
      JSON.parse<Vec3[]>(
        '[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]',
      ),
    ),
  ).toBe('[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]');
});

describe("Should deserialize top-level JSON.Obj arrays", () => {
  const empty = JSON.parse<JSON.Obj[]>("[]");
  expect(empty.length).toBe(0);
  expect(JSON.stringify(empty)).toBe("[]");

  const input =
    '[{"kind":"a","meta":{"x":1}},{"kind":"b","items":[1,true,"x"]}]';
  const parsed = JSON.parse<JSON.Obj[]>(input);
  expect(parsed.length).toBe(2);
  expect(parsed[0].get("kind")!.get<string>()).toBe("a");
  expect(parsed[0].get("meta")!.get<JSON.Obj>().get("x")!.get<f64>()).toBe(1.0);
  expect(parsed[1].get("kind")!.get<string>()).toBe("b");
  const items = parsed[1].get("items")!.get<JSON.Arr>();
  expect(items.length).toBe(3);
  expect(items.at(0).get<f64>()).toBe(1.0);
  expect(items.at(1).toString()).toBe("true");
  expect(items.at(2).get<string>()).toBe("x");
  expect(JSON.stringify(parsed)).toBe(
    '[{"kind":"a","meta":{"x":1}},{"kind":"b","items":[1,true,"x"]}]',
  );

  const spaced = JSON.parse<JSON.Obj[]>(
    ' [ { "kind" : "a" , "meta" : { "x" : 1 } } , { "kind" : "b" , "items" : [ 1 , true , "x" ] } ] ',
  );
  expect(spaced.length).toBe(2);
  expect(spaced[0].get("kind")!.get<string>()).toBe("a");
  expect(spaced[1].get("kind")!.get<string>()).toBe("b");
});

describe("Should serialize and deserialize date arrays", () => {
  const input = '["2025-02-03T21:28:40.525Z","1970-01-01T00:00:00.000Z"]';
  const parsed = JSON.parse<Date[]>(input);
  expect(parsed.length).toBe(2);
  expect(parsed[0].getUTCFullYear()).toBe(2025);
  expect(parsed[0].getUTCMilliseconds()).toBe(525);
  expect(parsed[1].getTime()).toBe(0);
  expect(JSON.stringify(parsed)).toBe(input);
});

describe("Should serialize and deserialize set arrays", () => {
  const input = "[[1,2],[3],[]]";
  const parsed = JSON.parse<Set<i32>[]>(input);
  expect(parsed.length).toBe(3);
  expect(parsed[0].has(1).toString()).toBe("true");
  expect(parsed[0].has(2).toString()).toBe("true");
  expect(parsed[1].has(3).toString()).toBe("true");
  expect(parsed[2].size).toBe(0);
  expect(JSON.stringify(parsed)).toBe(input);
});

// The generic-array path (Date[]/Set[]) tolerates whitespace and empty input.
// These cases exist to keep that behaviour pinned: every other array kind has
// its own SWAR/SIMD reader, so this is the only place the naive/array/generic
// scanner is exercised.
describe("Should parse an empty Date array", () => {
  const parsed = JSON.parse<Date[]>("[]");
  expect(parsed.length).toBe(0);
  expect(JSON.stringify(parsed)).toBe("[]");
});

describe("Should tolerate whitespace around and between Date elements", () => {
  const input =
    '  [ "2025-02-03T21:28:40.525Z" , "1970-01-01T00:00:00.000Z" ]  ';
  const parsed = JSON.parse<Date[]>(input);
  expect(parsed.length).toBe(2);
  expect(parsed[0].getUTCFullYear()).toBe(2025);
  expect(parsed[1].getTime()).toBe(0);
});

describe("Should parse an empty Set array", () => {
  const parsed = JSON.parse<Set<i32>[]>("[]");
  expect(parsed.length).toBe(0);
  expect(JSON.stringify(parsed)).toBe("[]");
});

describe("Should cover top-level struct array edge cases", () => {
  const empty = JSON.parse<Vec3[]>("[]");
  expect(empty.length).toBe(0);
  expect(JSON.stringify(empty)).toBe("[]");

  const spaced = JSON.parse<Vec3[]>(
    ' [ { "x" : 1.0 , "y" : 2.0 , "z" : 3.0 } , { "x" : 4.0 , "y" : 5.0 , "z" : 6.0 } ] ',
  );
  expect(spaced.length).toBe(2);
  expect(spaced[0].x.toString()).toBe("1.0");
  expect(spaced[1].z.toString()).toBe("6.0");
});

describe("Should deserialize raw arrays", () => {
  const r1 = JSON.parse<JSON.Raw[]>(
    '[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]',
  );
  expect<string>(r1[0].toString()).toBe('{"x":3.4,"y":1.2,"z":8.3}');
  expect<string>(r1[1].toString()).toBe('{"x":3.4,"y":-2.1,"z":9.3}');

  const r2 = JSON.parse<JSON.Raw[][]>(
    '[[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}],[{"x":0.1,"y":-7.3,"z":4.5}]]',
  );
  expect<string>(r2[0][0].toString()).toBe('{"x":3.4,"y":1.2,"z":8.3}');
  expect<string>(r2[0][1].toString()).toBe('{"x":3.4,"y":-2.1,"z":9.3}');
  expect<string>(r2[1][0].toString()).toBe('{"x":0.1,"y":-7.3,"z":4.5}');

  const r3 = JSON.parse<JSON.Raw[]>("[1,2,3,4,5]");
  expect<string>(r3[0].toString()).toBe("1");
  expect<string>(r3[1].toString()).toBe("2");
  expect<string>(r3[2].toString()).toBe("3");
  expect<string>(r3[3].toString()).toBe("4");
  expect<string>(r3[4].toString()).toBe("5");

  const r4 = JSON.parse<JSON.Raw[][]>("[[1,2,3,4,5],[6,7,8,9,10]]");
  expect<string>(r4[0][0].toString()).toBe("1");
  expect<string>(r4[0][1].toString()).toBe("2");
  expect<string>(r4[0][2].toString()).toBe("3");
  expect<string>(r4[0][3].toString()).toBe("4");
  expect<string>(r4[0][4].toString()).toBe("5");

  expect<string>(r4[1][0].toString()).toBe("6");
  expect<string>(r4[1][1].toString()).toBe("7");
  expect<string>(r4[1][2].toString()).toBe("8");
  expect<string>(r4[1][3].toString()).toBe("9");
  expect<string>(r4[1][4].toString()).toBe("10");

  const r5 = JSON.parse<JSON.Raw[]>(
    '[{"x":3.4,"y":1.2,"z":8.3},[1,2,3,4,5],"12345",true,false,null,[[]]]',
  );
  expect<string>(r5[0].toString()).toBe('{"x":3.4,"y":1.2,"z":8.3}');
  expect<string>(r5[1].toString()).toBe("[1,2,3,4,5]");
  expect<string>(r5[2].toString()).toBe('"12345"');
  expect<string>(r5[3].toString()).toBe("true");
  expect<string>(r5[4].toString()).toBe("false");
  expect<string>(r5[5].toString()).toBe("null");
  expect<string>(r5[6].toString()).toBe("[[]]");
});


@json
class Vec3 {
  x: f64 = 0.0;
  y: f64 = 0.0;
  z: f64 = 0.0;
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

describe("Should serialize and deserialize empty arrays", () => {
  expect(JSON.stringify<i32[]>([])).toBe("[]");
  expect(JSON.stringify(JSON.parse<i32[]>("[]"))).toBe("[]");
  expect(JSON.stringify(JSON.parse<string[]>("[]"))).toBe("[]");
});

describe("Should serialize single-item arrays without trailing commas", () => {
  expect(JSON.stringify<i32[]>([42])).toBe("[42]");
  expect(JSON.stringify<f32[]>([-0.5])).toBe("[-0.5]");
  expect(JSON.stringify<bool[]>([true])).toBe("[true]");
  expect(JSON.stringify<string[]>(["x"])).toBe('["x"]');
});

describe("Should preserve JSON.internal behavior for primitive arrays", () => {
  const ints = JSON.internal.stringify<i32[]>([1, 2, 3, 4]);
  const floats = JSON.internal.stringify<f32[]>([-1.5, 0.25, 3.75]);
  const bools = JSON.internal.stringify<bool[]>([true, false, true]);
  const strings = JSON.internal.stringify<string[]>(["alpha", "beta"]);

  expect(ints).toBe("[1,2,3,4]");
  expect(floats).toBe("[-1.5,0.25,3.75]");
  expect(bools).toBe("[true,false,true]");
  expect(strings).toBe('["alpha","beta"]');

  expect(JSON.internal.parse<i32[]>(ints).length).toBe(4);
  expect(JSON.internal.parse<f32[]>(floats)[0]).toBe(-1.5);
  expect(JSON.internal.parse<bool[]>(bools)[1].toString()).toBe("false");
  expect(JSON.internal.parse<string[]>(strings)[1]).toBe("beta");
});

describe("Should handle additional array shapes", () => {
  expect(
    JSON.stringify(JSON.parse<i32[]>("[-1,0,1,2147483647,-2147483648]")),
  ).toBe("[-1,0,1,2147483647,-2147483648]");
  expect(JSON.stringify(JSON.parse<string[][]>('[[],["x"],["y","z"]]'))).toBe(
    '[[],["x"],["y","z"]]',
  );
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

describe("Should serialize (Box<T> | null)[] for every primitive Box element", () => {
  expect(
    JSON.stringify<(JSON.Box<i32> | null)[]>([
      JSON.Box.from<i32>(1),
      null,
      JSON.Box.from<i32>(3),
    ]),
  ).toBe("[1,null,3]");
  expect(
    JSON.stringify<(JSON.Box<bool> | null)[]>([
      JSON.Box.from<bool>(true),
      null,
      JSON.Box.from<bool>(false),
    ]),
  ).toBe("[true,null,false]");
  expect(
    JSON.stringify<(JSON.Box<f64> | null)[]>([JSON.Box.from<f64>(0.5), null]),
  ).toBe("[0.5,null]");
  expect(JSON.stringify<(JSON.Box<i32> | null)[]>([null])).toBe("[null]");
});

describe("Should deserialize (string | null)[] preserving null slots", () => {
  const parsed = JSON.parse<(string | null)[]>('["a",null,"c",null]');
  expect(parsed.length).toBe(4);
  expect(parsed[0]!).toBe("a");
  expect((parsed[1] == null).toString()).toBe("true");
  expect(parsed[2]!).toBe("c");
  expect((parsed[3] == null).toString()).toBe("true");
});

describe("Should serialize string[] of non-null elements through nullable type", () => {
  expect(JSON.stringify<(string | null)[]>(["a", "b", "c"])).toBe(
    '["a","b","c"]',
  );
});

// ─── helpers ──────────────────────────────────────────────────────────────────

@json
class BoolArr {
  flags: bool[] = [];
}


@json
class Matrix {
  rows: i32[][] = [];
}

// ─── Naive array success paths ───────────────────────────────────────────────

describe("NAIVE: bool[] round-trips", () => {
  expect(JSON.stringify(JSON.parse<bool[]>("[true,false,true]"))).toBe(
    "[true,false,true]",
  );
});

describe("NAIVE: f64[] round-trips with negative and fractional", () => {
  expect(JSON.stringify(JSON.parse<f64[]>("[-1.5,0,2.5]"))).toBe(
    "[-1.5,0,2.5]",
  );
});

describe("Serialize: f32 array elements round-trip", () => {
  expect(JSON.stringify<f32[]>([-1.5, 0.25, 3.75])).toBe("[-1.5,0.25,3.75]");
});

describe("Serialize: empty i8[] array", () => {
  expect(JSON.stringify<i8[]>([])).toBe("[]");
});

describe("Serialize: empty u8[] array", () => {
  expect(JSON.stringify<u8[]>([])).toBe("[]");
});

// bool[] as @json field → deserializeBooleanArrayBody (SWAR)
describe("SWAR: bool[] field with inner whitespace covers whitespace loops", () => {
  const r = JSON.parse<BoolArr>('{"flags":[ true , false , true ]}');
  expect(r.flags.length).toBe(3);
  expect(r.flags[0]).toBe(true);
  expect(r.flags[1]).toBe(false);
});

describe("SWAR: bool[] field reparse with fewer elements (resize)", () => {
  const r = JSON.parse<BoolArr>('{"flags":[true,false,true]}');
  expect(r.flags.length).toBe(3);
  const r2 = JSON.parse<BoolArr>('{"flags":[true]}', r);
  expect(r2.flags.length).toBe(1);
  expect(r2.flags[0]).toBe(true);
});

// Array of arrays → naive/array/array.ts
describe("Naive: i32[][] round-trips in all modes", () => {
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1,2],[3,4,5]]"))).toBe(
    "[[1,2],[3,4,5]]",
  );
});

// naive/array/array.ts path 1: JSON.Value[][]
describe("Naive: JSON.Value[][] covers path-1 arbitraryInner Reference branch", () => {
  const arr = JSON.parse<JSON.Value[][]>('[[1,2],[3,"a"]]');
  expect(arr.length).toBe(2);
  expect(arr[0].length).toBe(2);
  expect(arr[1].length).toBe(2);
});

// swar/array/array.ts: shrink path when reparsing fewer inner arrays
describe("SWAR: Matrix.rows reparse with fewer inner arrays covers array-array body shrink path", () => {
  const m1 = JSON.parse<Matrix>('{"rows":[[1,2],[3,4],[5,6]]}');
  expect(m1.rows.length).toBe(3);
  const m2 = JSON.parse<Matrix>('{"rows":[[7,8]]}', m1);
  expect(m2.rows.length).toBe(1);
  expect(m2.rows[0][0]).toBe(7);
});
