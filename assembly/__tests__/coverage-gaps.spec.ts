import { JSON } from "..";
import { describe, expect } from "as-test";

// ─── helpers ──────────────────────────────────────────────────────────────────

@json
class Vec2 {
  x: f64 = 0;
  y: f64 = 0;
}


@json
class Named {
  name: string = "";
  value: i32 = 0;
}


@json
class PointCloud {
  label: string = "";
  points: Vec2[] = [];
  count: i32 = 0;
}


@json
class Grid {
  rows: Named[] = [];
  id: i32 = 0;
}


@json
class Bag {
  tag: string = "";
  items: Named[] = [];
}


@json
class F32Holder {
  v: f32 = 0.0;
}


@json
class Tagged {
  tags: string[] = [];
}


@json
class FloatArr {
  values: f64[] = [];
}


@json
class ObjArr {
  items: JSON.Obj[] = [];
}


@json
class BoolArr {
  flags: bool[] = [];
}


@json
class Matrix {
  rows: i32[][] = [];
}


@json
class UintVec {
  values: u32[] = [];
}


@json
class ValueArrHolder {
  vals: JSON.Value[] = [];
}


@json
class S1 {
  x: string = "";
}

// ─── JSON.Arr error paths ─────────────────────────────────────────────────────

describe("JSON.Arr: at() throws on out-of-range index", () => {
  expect((): void => {
    JSON.parse<JSON.Arr>("[1,2,3]").at(5);
  }).toThrow();
  expect((): void => {
    JSON.parse<JSON.Arr>("[1,2,3]").at(-4);
  }).toThrow();
});

describe("JSON.Arr: pop() throws on empty array", () => {
  expect((): void => {
    new JSON.Arr().pop();
  }).toThrow();
});

describe("JSON.Arr: shift() throws on empty array", () => {
  expect((): void => {
    new JSON.Arr().shift();
  }).toThrow();
});

describe("JSON.Arr: length setter throws on negative", () => {
  expect((): void => {
    const tmp = JSON.parse<JSON.Arr>("[1,2,3]");
    tmp.length = -1;
  }).toThrow();
});

describe("JSON.Arr: find() returns matching element", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3,4]");
  const v = a.find(
    (val: JSON.Value, _: i32, __: JSON.Arr): bool => val.get<f64>() > 2.0,
  );
  expect(v!.get<f64>()).toBe(3.0);
});

describe("JSON.Arr: findLast() returns null when none match", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  const v = a.findLast(
    (val: JSON.Value, _: i32, __: JSON.Arr): bool => val.get<f64>() > 10.0,
  );
  expect(changetype<usize>(v) == 0 ? "null" : "found").toBe("null");
});

describe("JSON.Arr: findLastIndex() returns -1 when none match", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  expect(
    a.findLastIndex(
      (val: JSON.Value, _: i32, __: JSON.Arr): bool => val.get<f64>() > 10.0,
    ),
  ).toBe(-1);
});

describe("JSON.Arr: reduce() sums all elements", () => {
  const a = JSON.parse<JSON.Arr>("[10,20,30]");
  const sum = a.reduce<f64>(
    (acc: f64, val: JSON.Value, _: i32, __: JSON.Arr): f64 =>
      acc + val.get<f64>(),
    0.0,
  );
  expect(sum).toBe(60.0);
});

describe("JSON.Arr: sort() is no-op on < 2 elements", () => {
  const one = new JSON.Arr();
  one.push<i32>(1);
  one.sort((x: JSON.Value, y: JSON.Value): i32 => 0);
  expect(one.length).toBe(1);
  const empty = new JSON.Arr();
  empty.sort((x: JSON.Value, y: JSON.Value): i32 => 0);
  expect(empty.length).toBe(0);
});

describe("JSON.Arr: lastIndexOf() returns -1 when not found", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  expect(a.lastIndexOf<f64>(99.0)).toBe(-1);
});

describe("JSON.Arr: join() with default separator", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  expect(a.join()).toBe("1,2,3");
});

describe("JSON.Arr: copyWithin() with negative indices", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  a.copyWithin(-2, -4);
  expect(JSON.stringify(a)).toBe("[1,2,3,2,3]");
});

describe("JSON.Arr: splice() with negative start", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  const removed = a.splice(-2);
  expect(removed.length).toBe(2);
  expect(a.length).toBe(3);
});

describe("JSON.Arr: toString()", () => {
  expect(JSON.parse<JSON.Arr>("[1,2]").toString()).toBe("[1,2]");
});

describe("JSON.Arr: from() wraps JSON.Value[] into JSON.Arr", () => {
  const arr: JSON.Value[] = [JSON.Value.from<i32>(1), JSON.Value.from<i32>(2)];
  const a = JSON.Arr.from(arr);
  expect(a.length).toBe(2);
  expect(a.at(0).get<i32>()).toBe(1);
});

// ─── JSON.Obj ─────────────────────────────────────────────────────────────────

describe("JSON.Obj: values() returns all stored values", () => {
  const obj = JSON.parse<JSON.Obj>('{"a":1,"b":2,"c":3}');
  const vals = obj.values();
  expect(vals.length).toBe(3);
});

describe("JSON.Obj: from() with Map<string, JSON.Value> builds object", () => {
  const m = new Map<string, JSON.Value>();
  m.set("x", JSON.Value.from<f64>(42.0));
  const obj = JSON.Obj.from(m);
  expect(obj.size).toBe(1);
  expect(obj.getAs<f64>("x")).toBe(42.0);
});

describe("JSON.Obj: large object uses hash index (17+ keys)", () => {
  let src = "{";
  for (let i = 0; i < 20; i++) {
    if (i > 0) src += ",";
    src += '"k' + i.toString() + '":' + i.toString();
  }
  src += "}";
  const obj = JSON.parse<JSON.Obj>(src);
  expect(obj.size).toBe(20);
  expect(obj.getAs<f64>("k19")).toBe(19.0);
  expect(obj.get("missing") == null ? "null" : "found").toBe("null");
});

// ─── JSON.Value getType ───────────────────────────────────────────────────────

describe("JSON.Value: getType<T> for various types", () => {
  const v = JSON.Value.from<i32>(5);
  expect(v.getType<i32>(5).toString()).toBe(JSON.Types.I32.toString());
  expect(v.getType<i64>(<i64>1).toString()).toBe(JSON.Types.I64.toString());
  expect(v.getType<f32>(<f32>1.0).toString()).toBe(JSON.Types.F32.toString());
  expect(v.getType<f64>(1.0).toString()).toBe(JSON.Types.F64.toString());
  expect(v.getType<bool>(true).toString()).toBe(JSON.Types.Bool.toString());
  expect(v.getType<string>("hi").toString()).toBe(JSON.Types.String.toString());
});

describe("JSON.Value: getType<T> for null nullable", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<string | null>(null).toString()).toBe(
    JSON.Types.Null.toString(),
  );
});

// ─── JSON.Box ─────────────────────────────────────────────────────────────────

describe("JSON.Box: fromValue() returns null for JSON null", () => {
  const b = JSON.Box.fromValue<i32>(JSON.parse<JSON.Value>("null"));
  expect(changetype<usize>(b) == 0 ? "null" : "set").toBe("null");
});

describe("JSON.Box: fromValue() returns boxed value for non-null", () => {
  const b = JSON.Box.fromValue<f64>(JSON.parse<JSON.Value>("42"));
  expect(b!.value).toBe(42.0);
});

describe("JSON.Box: toString() on null box serializes as null", () => {
  expect(JSON.stringify<JSON.Box<i32> | null>(null)).toBe("null");
});

describe("JSON.Value: setWide u64 within inline range", () => {
  const v = JSON.Value.from<u64>(12345678);
  expect(v.get<u64>()).toBe(12345678);
});

describe("JSON.Value: setWide u64 beyond inline range spills to heap", () => {
  const big: u64 = 35184372088833; // 2^45 + 1
  const v = JSON.Value.from<u64>(big);
  expect(v.get<u64>()).toBe(big);
});

describe("JSON.Value: setWide i64 within inline range", () => {
  const v = JSON.Value.from<i64>(-99999);
  expect(v.get<i64>()).toBe(-99999);
});

describe("JSON.Value: setWide i64 beyond inline range spills to heap", () => {
  const big: i64 = -35184372088833; // -(2^45 + 1)
  const v = JSON.Value.from<i64>(big);
  expect(v.get<i64>()).toBe(big);
});

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

// ─── Serialize edge cases ─────────────────────────────────────────────────────

describe("Serialize: f32 array elements round-trip", () => {
  expect(JSON.stringify<f32[]>([-1.5, 0.25, 3.75])).toBe("[-1.5,0.25,3.75]");
});

describe("Serialize: empty i8[] array", () => {
  expect(JSON.stringify<i8[]>([])).toBe("[]");
});

describe("Serialize: empty u8[] array", () => {
  expect(JSON.stringify<u8[]>([])).toBe("[]");
});

describe("Serialize: string with \\uXXXX unicode escape", () => {
  const s = "\x01\x02\x1f";
  const json = JSON.stringify(s);
  expect(json).toBe('"\\u0001\\u0002\\u001f"');
  expect(JSON.parse<string>(json)).toBe(s);
});

// ─── TypedArray reuse paths ───────────────────────────────────────────────────

describe("TypedArray: parse into non-empty pre-allocated buffer (reuse path)", () => {
  const pre = new Uint8Array(8);
  const result = JSON.parse<Uint8Array>("[1,2,3]", pre);
  expect(result.length).toBe(3);
  expect(result[0]).toBe(1);
  expect(result[2]).toBe(3);
});

describe("ArrayBuffer: parse into non-empty pre-allocated buffer (reuse path)", () => {
  const pre = new ArrayBuffer(8);
  const result = JSON.parse<ArrayBuffer>("[10,20,30]", pre);
  expect(result.byteLength).toBe(3);
  expect(load<u8>(changetype<usize>(result))).toBe(10);
});

// ─── SWAR string array edge cases ────────────────────────────────────────────

describe("SWAR: string[] empty array from top-level parse", () => {
  expect(JSON.stringify(JSON.parse<string[]>("[]"))).toBe("[]");
});

describe("SWAR: string[] with whitespace around brackets", () => {
  expect(JSON.stringify(JSON.parse<string[]>('  [ "a" , "b" ]  '))).toBe(
    '["a","b"]',
  );
});

// ─── Struct array via slow path ───────────────────────────────────────────────

describe("Struct array as field: slow-path (out-of-order JSON) round-trips", () => {
  const src =
    '{"label":"cloud","count":3,"points":[{"x":1,"y":2},{"x":3,"y":4},{"x":5,"y":6}]}';
  const r = JSON.parse<PointCloud>(src);
  expect(r.label).toBe("cloud");
  expect(r.count).toBe(3);
  expect(r.points.length).toBe(3);
  expect(r.points[0].x).toBe(1.0);
  expect(r.points[2].y).toBe(6.0);
});

describe("Struct array as field: reused array (second parse) round-trips", () => {
  const first = JSON.parse<Grid>('{"id":1,"rows":[{"name":"a","value":1}]}');
  expect(first.rows.length).toBe(1);
  const second = JSON.parse<Grid>(
    '{"id":2,"rows":[{"name":"x","value":9},{"name":"y","value":8}]}',
    first,
  );
  expect(second.rows.length).toBe(2);
  expect(second.rows[0].name).toBe("x");
  expect(second.rows[1].value).toBe(8);
});

describe("Struct array as field: empty array in slow path", () => {
  const r = JSON.parse<Bag>('{"tag":"empty","items":[]}');
  expect(r.tag).toBe("empty");
  expect(r.items.length).toBe(0);
});

// ─── Whitespace trimming ──────────────────────────────────────────────────────

describe("JSON.__deserialize: leading whitespace is skipped", () => {
  expect(JSON.parse<i32>("   42")).toBe(42);
  expect(JSON.parse<string>('  "hello"')).toBe("hello");
});

// ─── SWAR integer array edge cases ───────────────────────────────────────────

describe("SWAR: i8[] parses negative values correctly", () => {
  expect(JSON.stringify(JSON.parse<i8[]>("[-128,0,127]"))).toBe("[-128,0,127]");
});

describe("SWAR: u8[] single-digit values", () => {
  expect(JSON.stringify(JSON.parse<u8[]>("[5,9,7]"))).toBe("[5,9,7]");
});

describe("SWAR: i16[] round-trips", () => {
  expect(JSON.stringify(JSON.parse<i16[]>("[-32768,0,32767]"))).toBe(
    "[-32768,0,32767]",
  );
});

describe("SWAR: i64[] round-trips with small values", () => {
  expect(JSON.stringify(JSON.parse<i64[]>("[0,-100,100]"))).toBe(
    "[0,-100,100]",
  );
});

describe("SWAR: u64[] round-trips with small values", () => {
  expect(JSON.stringify(JSON.parse<u64[]>("[0,100,200]"))).toBe("[0,100,200]");
});

describe("SWAR: i32[] round-trips", () => {
  expect(JSON.stringify(JSON.parse<i32[]>("[1,-2,3]"))).toBe("[1,-2,3]");
});

// ─── f32 field serialization ──────────────────────────────────────────────────

describe("Serialize: @json class with f32 field", () => {
  const h = new F32Holder();
  h.v = 1.5;
  expect(JSON.stringify(h)).toBe('{"v":1.5}');
  expect(JSON.parse<F32Holder>('{"v":3.14}').v.toString()).toBe(
    (<f32>3.14).toString(),
  );
});

// ─── Set serialization edge cases ────────────────────────────────────────────

describe("Serialize: empty Set<i32>", () => {
  expect(JSON.stringify(new Set<i32>())).toBe("[]");
});

describe("Serialize: Set<i64> with large value", () => {
  const s = new Set<i64>();
  s.add(9999999999999);
  s.add(-9999999999999);
  const out = JSON.stringify(s);
  expect(out.includes("9999999999999")).toBe(true);
});

// ─── string[] as @json field → deserializeStringArrayBody ─────────────────────

describe("SWAR: string[] as @json class field round-trips", () => {
  const t = JSON.parse<Tagged>('{"tags":["x","y","z"]}');
  expect(t.tags.length).toBe(3);
  expect(t.tags[1]).toBe("y");
});

describe("SWAR: string[] field reparse with fewer elements (resize)", () => {
  const t = JSON.parse<Tagged>('{"tags":["a","b","c"]}');
  expect(t.tags.length).toBe(3);
  const t2 = JSON.parse<Tagged>('{"tags":["only"]}', t);
  expect(t2.tags.length).toBe(1);
  expect(t2.tags[0]).toBe("only");
});

// ─── f64[] as @json field → deserializeFloatArrayBody ────────────────────────

describe("SWAR: f64[] as @json class field round-trips", () => {
  const f = JSON.parse<FloatArr>('{"values":[1.5,-2.5,0]}');
  expect(f.values.length).toBe(3);
  expect(f.values[0]).toBe(1.5);
});

describe("SWAR: f64[] empty array as @json class field", () => {
  const f = JSON.parse<FloatArr>('{"values":[]}');
  expect(f.values.length).toBe(0);
});

describe("SWAR: f64[] with large exponent triggers scientific() path", () => {
  const f = JSON.parse<FloatArr>('{"values":[1e25,5e-25]}');
  expect(f.values.length).toBe(2);
  expect(f.values[0]).toBe(1e25);
});

describe("SWAR: f64[] reparse with fewer elements (resize)", () => {
  const f = JSON.parse<FloatArr>('{"values":[1.1,2.2,3.3]}');
  expect(f.values.length).toBe(3);
  const f2 = JSON.parse<FloatArr>('{"values":[9.9]}', f);
  expect(f2.values.length).toBe(1);
  expect(f2.values[0]).toBe(9.9);
});

// ─── JSON.Obj[] as @json field → deserializeObjectArrayBody ──────────────────

describe("SWAR: JSON.Obj[] as @json class field round-trips", () => {
  const o = JSON.parse<ObjArr>('{"items":[{"x":1},{"y":2}]}');
  expect(o.items.length).toBe(2);
  expect(o.items[0].getAs<f64>("x")).toBe(1.0);
});

describe("SWAR: JSON.Obj[] empty array as @json class field", () => {
  const o = JSON.parse<ObjArr>('{"items":[]}');
  expect(o.items.length).toBe(0);
});

// ─── bool[] as @json field → deserializeBooleanArrayBody (SWAR) ──────────────

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

// ─── Array of arrays → naive/array/array.ts ───────────────────────────────────

describe("Naive: i32[][] round-trips in all modes", () => {
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1,2],[3,4,5]]"))).toBe(
    "[[1,2],[3,4,5]]",
  );
});

// ─── Trailing whitespace in top-level bool/float arrays ───────────────────────

describe("NAIVE: bool[] with trailing whitespace covers naive trailing loop", () => {
  expect(JSON.stringify(JSON.parse<bool[]>("[true,false]   "))).toBe(
    "[true,false]",
  );
});

describe("NAIVE: f64[] with trailing whitespace covers naive trailing loop", () => {
  expect(JSON.stringify(JSON.parse<f64[]>("[1.5,-2.5]   "))).toBe("[1.5,-2.5]");
});

// ─── naive/array/array.ts path 1: JSON.Value[][] ─────────────────────────────

describe("Naive: JSON.Value[][] covers path-1 arbitraryInner Reference branch", () => {
  const arr = JSON.parse<JSON.Value[][]>('[[1,2],[3,"a"]]');
  expect(arr.length).toBe(2);
  expect(arr[0].length).toBe(2);
  expect(arr[1].length).toBe(2);
});

// ─── swar/array/float.ts: fallbackStore via >19-digit mantissa ────────────────

describe("SWAR: f64[] with >19 mantissa digits triggers fallbackStore", () => {
  const f = JSON.parse<f64[]>("[1.12345678901234567890]");
  expect(f.length).toBe(1);
});

// ─── swar/array/integer.ts: SWAR reuse path (useSWAR && reusableLength != 0) ─

describe("SWAR: i32[] reparse into existing array covers signed SWAR reuse path", () => {
  const a = JSON.parse<i32[]>("[1,2,3]");
  expect(a.length).toBe(3);
  const b = JSON.parse<i32[]>("[4,5,6]", a);
  expect(b.length).toBe(3);
  expect(b[0]).toBe(4);
  expect(b[2]).toBe(6);
});

describe("SWAR: u32[] reparse with 6-digit numbers covers unsigned SWAR reuse path with SWAR batch and scalar tail", () => {
  const a = JSON.parse<u32[]>("[123456,789012]");
  expect(a.length).toBe(2);
  const b = JSON.parse<u32[]>("[234567,890123]", a);
  expect(b.length).toBe(2);
  expect(b[0]).toBe(234567);
  expect(b[1]).toBe(890123);
});

describe("SWAR: i32[] reparse with negatives covers negative branch in SWAR reuse path", () => {
  const a = JSON.parse<i32[]>("[1,2,3]");
  const b = JSON.parse<i32[]>("[-1,-2,-3]", a);
  expect(b.length).toBe(3);
  expect(b[0]).toBe(-1);
  expect(b[2]).toBe(-3);
});

describe("SWAR: i32[] reparse with 6-digit numbers covers SWAR 4-digit batch and scalar tail", () => {
  const a = JSON.parse<i32[]>("[123456,789012]");
  const b = JSON.parse<i32[]>("[234567,890123]", a);
  expect(b[0]).toBe(234567);
  expect(b[1]).toBe(890123);
});

describe("SWAR: i32[] reparse larger-than-capacity array bails reuse path correctly", () => {
  const a = JSON.parse<i32[]>("[1,2]");
  const b = JSON.parse<i32[]>("[1,2,3]", a);
  expect(b.length).toBe(3);
  expect(b[2]).toBe(3);
});

describe("SWAR: u32[] reparse larger-than-capacity array covers unsigned capacity overflow path", () => {
  const a = JSON.parse<u32[]>("[1,2]");
  const b = JSON.parse<u32[]>("[1,2,3]", a);
  expect(b.length).toBe(3);
  expect(b[2]).toBe(3);
});

// ─── swar/array/integer.ts: SLOW path unsigned branch via whitespace ──────────

describe("SWAR: u32[] with internal whitespace triggers SLOW unsigned path", () => {
  const a = JSON.parse<u32[]>("[ 10, 20, 30 ]");
  expect(a.length).toBe(3);
  expect(a[0]).toBe(10);
  expect(a[2]).toBe(30);
});

// ─── swar/float.ts: deserializeFloatField_SWAR exponent paths ─────────────────

describe("SWAR: f64 struct field with positive exponent covers exponent block", () => {
  const v = JSON.parse<Vec2>('{"x":1.5e2,"y":3.0e0}');
  expect(v.x).toBe(150.0);
  expect(v.y).toBe(3.0);
});

describe("SWAR: f64 struct field with plus-sign exponent covers ASCII_PLUS branch", () => {
  const v = JSON.parse<Vec2>('{"x":2.0e+1,"y":5.0e+0}');
  expect(v.x).toBe(20.0);
  expect(v.y).toBe(5.0);
});

describe("SWAR: f64 struct field with negative exponent covers ASCII_MINUS branch", () => {
  const v = JSON.parse<Vec2>('{"x":1.5e-2,"y":2.0e-1}');
  expect(v.x).toBeCloseTo(0.015);
  expect(v.y).toBeCloseTo(0.2);
});

describe("SWAR: f64 struct field with large exponent covers scientific fallback path", () => {
  const v = JSON.parse<Vec2>('{"x":1e100,"y":2e-100}');
  expect(isFinite(v.x)).toBe(true);
  expect(v.x).toBeCloseTo(1e100);
});

describe("SWAR: f64 struct field with >19 mantissa digits covers fallbackField", () => {
  const v = JSON.parse<Vec2>('{"x":1.23456789012345678901,"y":0.0}');
  expect(v.x).toBeCloseTo(1.2345678901234568);
  expect(v.y).toBe(0.0);
});

// ─── swar/float.ts: deserializeFloat_SWAR exponent loop non-digit break ──────

describe("SWAR: standalone f64 with trailing space after exponent covers d>9 break", () => {
  expect(JSON.parse<f64>("1e5 ").toString()).toBe((1e5).toString());
});

describe("SWAR: standalone f64 with 5-digit exponent covers expDigits>4 standalone path", () => {
  expect(!isFinite(JSON.parse<f64>("1e55555"))).toBe(true);
});

// ─── swar/float.ts: fallbackField f32 path ────────────────────────────────────

describe("SWAR: f32 struct field with >19 mantissa digits covers fallbackField f32 branch", () => {
  const h = JSON.parse<F32Holder>('{"v":1.23456789012345678901}');
  expect(h.v).toBeCloseTo(<f32>1.2345678901234568);
});

// ─── swar/float.ts: deserializeFloatField_SWAR 5-digit exponent path ──────────

describe("SWAR: f64 struct field with 5-digit exponent covers expDigits>4 in struct", () => {
  const v = JSON.parse<Vec2>('{"x":1e55555,"y":0.0}');
  expect(!isFinite(v.x)).toBe(true);
  expect(v.y).toBe(0.0);
});

// ─── swar/array/integer.ts: empty array in SLOW path and reuse path ───────────

describe("SWAR: i32[] with only whitespace covers SLOW empty-array early return", () => {
  const a = JSON.parse<i32[]>("[  ]");
  expect(a.length).toBe(0);
});

describe("SWAR: i32[] empty reparse into existing array covers reuse empty-array return", () => {
  const a = JSON.parse<i32[]>("[1,2,3]");
  const b = JSON.parse<i32[]>("[]", a);
  expect(b.length).toBe(0);
});

// ─── naive/array/struct.ts: shrink path when reparsing fewer elements ─────────

describe("Naive: Named[] reparse with fewer elements covers struct-array shrink path", () => {
  const a = JSON.parse<Named[]>(
    '[{"name":"a","value":1},{"name":"b","value":2},{"name":"c","value":3}]',
  );
  expect(a.length).toBe(3);
  const b = JSON.parse<Named[]>('[{"name":"x","value":10}]', a);
  expect(b.length).toBe(1);
  expect(b[0].name).toBe("x");
});

// ─── swar/array/array.ts: shrink path when reparsing fewer inner arrays ────────

describe("SWAR: Matrix.rows reparse with fewer inner arrays covers array-array body shrink path", () => {
  const m1 = JSON.parse<Matrix>('{"rows":[[1,2],[3,4],[5,6]]}');
  expect(m1.rows.length).toBe(3);
  const m2 = JSON.parse<Matrix>('{"rows":[[7,8]]}', m1);
  expect(m2.rows.length).toBe(1);
  expect(m2.rows[0][0]).toBe(7);
});

// ─── swar/array/integer.ts: deserializeIntegerArrayBody unsigned path ─────────

describe("SWAR: UintVec struct field covers unsigned path in deserializeIntegerArrayBody", () => {
  const v = JSON.parse<UintVec>('{"values":[1,2,3]}');
  expect(v.values.length).toBe(3);
  expect(v.values[0]).toBe(1);
});

describe("SWAR: UintVec struct field reparse with fewer elements covers body shrink path", () => {
  const v1 = JSON.parse<UintVec>('{"values":[1,2,3]}');
  expect(v1.values.length).toBe(3);
  const v2 = JSON.parse<UintVec>('{"values":[4,5]}', v1);
  expect(v2.values.length).toBe(2);
  expect(v2.values[0]).toBe(4);
});

// ─── naive/array/integer.ts: trailing whitespace stripping loop ───────────────

describe("NAIVE: i32[] with trailing whitespace covers deserializeIntegerArray_NAIVE trailing loop", () => {
  const a = JSON.parse<i32[]>("[1,2,3]   ");
  expect(a.length).toBe(3);
  expect(a[0]).toBe(1);
  expect(a[2]).toBe(3);
});

// ─── swar/array/float.ts: parseFloatElementSWAR exponent paths ───────────────

describe("SWAR: f64[] with e+ notation covers parseFloatElementSWAR positive-exponent path", () => {
  const a = JSON.parse<f64[]>("[1e5,2e+3,3e-1]");
  expect(a.length).toBe(3);
  expect(a[0]).toBe(100000.0);
  expect(a[1]).toBe(2000.0);
  expect<f64>(a[2]).toBeCloseTo(0.3);
});

describe("SWAR: f32[] with >19 mantissa digits covers fallbackStore f32 path", () => {
  const a = JSON.parse<f32[]>("[1.12345678901234567890]");
  expect(a.length).toBe(1);
  expect<f32>(a[0]).toBeCloseTo(1.1234568);
});

describe("SWAR: f64[] with 5-digit exponent covers parseFloatElementSWAR expDigits>4 fallback", () => {
  const a = JSON.parse<f64[]>("[1e55555]");
  expect(a.length).toBe(1);
  expect(!isFinite(a[0])).toBe(true);
});

// ─── swar/string.ts: false-positive SWAR path in deserializeString_SWAR ──────
// U+5C5C has UTF-16 LE bytes 0x5C 0x5C — both trigger the SWAR backslash mask,
// producing a false positive that `(header & 0xffff) !== 0x5c` discards. A
// string of 17 chars (1 × U+5C5C + 16 × A) is long enough that the 16-byte
// fast-scan breaks early (m0 != 0) and the SWAR scan must handle the false
// positive: line 195 (continue), line 200 (srcStart += 8), line 210 (return).

describe("SWAR: string with U+5C5C covers deserializeString_SWAR false-positive path", () => {
  const s = JSON.parse<string>('"屜AAAAAAAAAAAAAAAA"');
  expect(s.charCodeAt(0)).toBe(0x5c5c);
  expect(s.length).toBe(17);
});

// ─── swar/string.ts: false-positive in deserializeEscapedString_SWAR ─────────
// A real \n escape followed immediately by U+5C5C puts the U+5C5C in the first
// post-escape SWAR block, triggering two false positives (line 108) and the
// !handled branch (lines 123-125) within deserializeEscapedString_SWAR.

describe("SWAR: escaped string with U+5C5C covers deserializeEscapedString_SWAR false-positive path", () => {
  const s = JSON.parse<string>('"\\n屜AAAAAAAAAAA"');
  expect(s.charCodeAt(0)).toBe(10);
  expect(s.charCodeAt(1)).toBe(0x5c5c);
  expect(s.length).toBe(13);
});

// ─── serialize/simd/string.ts: surrogate-pair path ───────────────────────────
// Emoji 😊 is a surrogate pair (U+1F60A = 0xD83D 0xDE0A). In SIMD mode the
// serializer must mask out the low surrogate to avoid double-escaping it,
// covering the LogicalBranch, Block, and Assignment at line 143-145.

// serializeString_SIMD only runs its 16-byte SIMD block loop when the string
// is longer than 16 bytes. The surrogate-pair detection at lines 143-145 fires
// when SPLAT_FFD8 catches the high byte of a surrogate and the next char is a
// valid low surrogate. A 4-byte emoji string is too short for the SIMD loop;
// placing 😊 at the START of an 18-char string (4+32=36 bytes) ensures the
// first 16-byte block is processed by the SIMD loop and contains the surrogate.
describe("SIMD: stringify long emoji string covers surrogate-pair path in serializeString_SIMD", () => {
  const s = JSON.stringify("😊AAAAAAAAAAAAAAAA");
  expect(s).toBe('"😊AAAAAAAAAAAAAAAA"');
});

// ─── index.ts: JSON.Value.getType for additional types ───────────────────────

describe("JSON.Value: getType<T> for small signed integers (i8, i16)", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<i8>(<i8>1).toString()).toBe(JSON.Types.I8.toString());
  expect(v.getType<i16>(<i16>1).toString()).toBe(JSON.Types.I16.toString());
});

// u8, u16, u64 fail to compile with getType<T> because the function body
// contains `changetype<usize>(value)` which is invalid for those widths on
// 32-bit WASM. Only u32 compiles cleanly (usize == u32 on WASM32).
describe("JSON.Value: getType<T> for u32 (safe on WASM32 usize==u32)", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<u32>(<u32>1).toString()).toBe(JSON.Types.U32.toString());
});

describe("JSON.Value: getType<T> for JSON.Box recurses to inner type", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<JSON.Box<i32>>(new JSON.Box<i32>(5)).toString()).toBe(
    JSON.Types.I32.toString(),
  );
});

describe("JSON.Value: getType<T> for JSON.Value[] returns Array", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<JSON.Value[]>(new Array<JSON.Value>(0)).toString()).toBe(
    JSON.Types.Array.toString(),
  );
});

describe("JSON.Value: getType<T> for JSON.Arr returns Array", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<JSON.Arr>(new JSON.Arr()).toString()).toBe(
    JSON.Types.Array.toString(),
  );
});

describe("JSON.Value: getType<T> for JSON.Obj returns Object", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<JSON.Obj>(new JSON.Obj()).toString()).toBe(
    JSON.Types.Object.toString(),
  );
});

describe("JSON.Value: getType<T> for TypedArray returns TypedArray", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<Int32Array>(new Int32Array(1)).toString()).toBe(
    JSON.Types.TypedArray.toString(),
  );
});

describe("JSON.Value: getType<T> for Map returns Map", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<Map<string, i32>>(new Map<string, i32>()).toString()).toBe(
    JSON.Types.Map.toString(),
  );
});

// ─── index.ts: JSON.Value.toString() for small unsigned types and Null ────────

describe("JSON.Value: toString() for U8 value", () => {
  expect(JSON.Value.from<u8>(<u8>200).toString()).toBe("200");
});

describe("JSON.Value: toString() for U16 value", () => {
  expect(JSON.Value.from<u16>(<u16>1000).toString()).toBe("1000");
});

describe("JSON.Value: toString() for U32 value", () => {
  expect(JSON.Value.from<u32>(<u32>99999).toString()).toBe("99999");
});

describe("JSON.Value: toString() for U64 value", () => {
  expect(JSON.Value.from<u64>(<u64>123456789).toString()).toBe("123456789");
});

describe("JSON.Value: toString() for Null JSON.Value", () => {
  expect(JSON.parse<JSON.Value>("null").toString()).toBe("null");
});

// ─── index.ts: boolBits(false) via JSON.Obj parsing ──────────────────────────
// naive/object.ts line 164 calls boolBits(false) when parsing `false` in an
// arbitrary JSON object (JSON.Obj). This covers the false branch of the Ternary
// `b ? 1 : 0` in JSON.Value.boolBits (index.ts line 914).

describe("JSON.Value: boolBits false branch via JSON.Obj with false value", () => {
  const obj = JSON.parse<JSON.Obj>('{"active":false,"count":1}');
  const val = obj.get("active")!;
  expect(val.get<bool>()).toBe(false);
});

// ─── index.ts: JSON.Arr.forEach loop ─────────────────────────────────────────

// AS does not support closures; use a non-capturing callback to exercise the
// JSON.Arr.forEach loop body (index.ts line 2118) without capturing outer vars.
describe("JSON.Arr: forEach loop body fires for each element", () => {
  const arr = JSON.parse<JSON.Arr>("[10,20,30]");
  arr.forEach((val: JSON.Value, _i: i32, _arr: JSON.Arr): void => {
    const _unused = val.get<f64>();
  });
  expect(arr.length).toBe(3);
});

// ─── JSON.Arr.ensureValCap growth ────────────────────────────────────────────

// Pushing 9 elements into a fresh JSON.Arr forces ensureValCap to grow from
// its initial 8-slot allocation: cap=8 > 0 (Ternary true), n<<1 until n>=9
// (Loop + Assignment), and memory.copy since _vused=8 (IfBranch).
describe("JSON.Arr: push 9 elements forces ensureValCap to grow past initial 8-slot allocation", () => {
  const arr = new JSON.Arr();
  for (let i = 0; i < 9; i++) arr.push<i32>(i);
  expect(arr.length).toBe(9);
  expect(arr.at(8).get<i32>()).toBe(8);
});

// ─── JSON.Arr.storeSlot LogicalBranch (heap-boxed u64) ───────────────────────

// VAL_U64_LIMIT = 2^45. Values >= limit spill to heap (VAL_BOX64 flag set),
// triggering the LogicalBranch at storeSlot line 1831 that __link-s the box.
describe("JSON.Arr: push heap-boxed u64 covers storeSlot LogicalBranch for boxed u64", () => {
  const big: u64 = 35184372088833; // >= 2^45 → heap-boxed with VAL_BOX64
  const arr = new JSON.Arr();
  arr.push<u64>(big);
  expect(arr.at(0).get<u64>()).toBe(big);
});

// ─── JSON.Arr.from fast-path (JSON.Arr input) ────────────────────────────────

// Passing a JSON.Arr directly to from() hits the instanceof JSON.Arr fast-path
// at line 1919 which returns the input unchanged.
describe("JSON.Arr: from(JSON.Arr) returns the same array via instanceof fast-path", () => {
  const a = JSON.parse<JSON.Arr>("[1,2,3]");
  const b = JSON.Arr.from(a);
  expect(b.length).toBe(3);
});

// NOTE: JSON.Arr.from(JSON.Obj) throw path (line 1930) is NOT testable via
// toThrow() because the try-as transform does not intercept aborts from static
// generic methods called with @final types in this version. Skipped.

// ─── JSON.Arr.fill DefaultValue and negative end ─────────────────────────────

// Calling fill() with only value uses default start=0 (covers DefaultValue at
// line 2024:36). Calling fill(v, 0, -2) uses end<0 branch (covers Ternary true
// at line 2027:27).
describe("JSON.Arr: fill() with default start=0 covers DefaultValue parameter path", () => {
  const arr = JSON.parse<JSON.Arr>("[1,2,3]");
  arr.fill(JSON.Value.from<i32>(9));
  expect(arr.at(0).get<i32>()).toBe(9);
  expect(arr.at(2).get<i32>()).toBe(9);
});

describe("JSON.Arr: fill() with negative end covers end<0 ternary branch", () => {
  const arr = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  arr.fill(JSON.Value.from<i32>(0), 0, -2); // e = max(5-2, 0) = 3 → fills indices 0..2
  expect(arr.at(0).get<i32>()).toBe(0);
  expect(arr.at(3).get<f64>()).toBe(4.0); // index 3 is raw f64 slot, unchanged
});

// ─── JSON.Arr.copyWithin negative end ────────────────────────────────────────

// Passing a negative end triggers the end<0 ternary branch at line 2038:27.
describe("JSON.Arr: copyWithin() with negative end covers end<0 ternary branch", () => {
  const arr = JSON.parse<JSON.Arr>("[1,2,3,4,5]");
  arr.copyWithin(0, 1, -1); // end = max(5-1, 0) = 4 → copies raw f64 slots 1..3 to 0..2
  expect(arr.at(0).get<f64>()).toBe(2.0);
  expect(arr.at(1).get<f64>()).toBe(3.0);
});

// ─── JSON.Obj.values() lazy slot branch ──────────────────────────────────────

// Parsing a JSON.Obj where at least one value is a string stores that slot
// lazily. Calling values() then hits the slotIsLazy=true branch at line 1691.
describe("JSON.Obj: values() with a string value covers lazy slot branch", () => {
  const obj = JSON.parse<JSON.Obj>('{"name":"alice","count":42}');
  const vals = obj.values();
  expect(vals.length).toBe(2);
});

// ─── JSON.Obj.storeSlot LogicalBranch (heap-boxed u64) ───────────────────────

// Same VAL_BOX64 path as JSON.Arr.storeSlot but for JSON.Obj.storeSlot line
// 1360 — triggered by set<u64> with a value >= VAL_U64_LIMIT.
describe("JSON.Obj: set<u64> with large value covers storeSlot LogicalBranch for boxed u64", () => {
  const obj = new JSON.Obj();
  const big: u64 = 35184372088833; // >= 2^45 → heap-boxed
  obj.set<u64>("big", big);
  expect(obj.getAs<u64>("big")).toBe(big);
});

// ─── SIMD: utf16Equals_SIMD false-return branch ──────────────────────────────

// Looking up a key with the same length (8 chars) as an existing key but
// different content causes utf16Equals_SIMD to find a mismatch and return false
// (line 147). In NAIVE/SWAR modes the scalar path returns false equivalently.
describe("SIMD: JSON.Obj lookup with same-length mismatched key covers utf16Equals_SIMD false-return path", () => {
  const obj = JSON.parse<JSON.Obj>('{"abcdefgh":1}');
  const result = obj.get("abcdefgi"); // 8 chars, differs only in last → SIMD mismatch
  expect(result).toBeNull();
});

// ─── index.ts: getType<T> additional branches ────────────────────────────────

// getType<usize>(0) hits the usize-null sentinel branch at line 979.
describe("JSON.Value: getType<usize>(0) covers usize-null sentinel branch returning Null", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<usize>(<usize>0).toString()).toBe(
    JSON.Types.Null.toString(),
  );
});

// getType<Vec2> hits the isDefined(__SERIALIZE) struct branch at line 997.
describe("JSON.Value: getType<Vec2> covers isDefined(__SERIALIZE) struct branch", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<Vec2>(new Vec2()) >= JSON.Types.Struct).toBe(true);
});

// getType<ArrayBuffer> hits the instanceof ArrayBuffer branch at line 1012.
describe("JSON.Value: getType<ArrayBuffer> covers instanceof ArrayBuffer branch", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<ArrayBuffer>(new ArrayBuffer(0)).toString()).toBe(
    JSON.Types.ArrayBuffer.toString(),
  );
});

// getType<JSON.Raw> hits the instanceof JSON.Raw branch at line 1014.
describe("JSON.Value: getType<JSON.Raw> covers instanceof Raw branch", () => {
  const v = JSON.Value.from<i32>(0);
  expect(v.getType<JSON.Raw>(new JSON.Raw("null")).toString()).toBe(
    JSON.Types.Raw.toString(),
  );
});

// NOTE: bool[] error paths in naive/array/bool.ts (lines 33,35,60,64) are NOT
// testable via toThrow() — try-as does not intercept aborts from generic
// deserializer functions. Skipped.

// ─── swar/array/generic.ts: empty JSON.Value[] field ─────────────────────────

describe("SWAR: JSON.Value[] field with empty array covers deserializeGenericArrayBody empty-array return", () => {
  const h = JSON.parse<ValueArrHolder>('{"vals":[]}');
  expect(h.vals.length).toBe(0);
});

// ─── swar/string.ts: false-positive handling in non-escaped scan ──────────────
// U+225C (≜) has low byte 0x5C which matches the backslash SWAR mask, but
// load<u16> returns 0x225C which is neither QUOTE nor BACK_SLASH.

describe("SWAR: string field with U+225C triggers false-positive skip in deserializeStringField_SWAR", () => {
  const n = JSON.parse<Named>('{"name":"≜world","value":1}');
  expect(n.name).toBe("≜world");
  expect(n.value).toBe(1);
});

// ─── swar/string.ts: false-positive in deserializeEscapedStringField_SWAR ─────
// A backslash escape before ≜ enters deserializeEscapedStringField_SWAR.
// The SWAR block containing ≜ (bytes 0x5C 0x22) has two false-positive hits
// followed by plain chars, so `handled` stays false → covers the !handled block.

describe("SWAR: escaped string field with U+225C triggers false-positive in deserializeEscapedStringField_SWAR", () => {
  const n = JSON.parse<Named>('{"name":"\\n≜world","value":2}');
  expect(n.name.length > 0).toBe(true);
  expect(n.value).toBe(2);
});

// ─── swar/string.ts: tail-scan regular escape ─────────────────────────────────
// "hello\n\\" in JSON: the `\n` is in the last SWAR block and its handling sets
// srcStart past srcEnd8, landing on the second `\\`, which the tail scan then
// processes — covering the `code !== 0x75` branch at lines 347-350.

describe("SWAR: escaped string field where tail scan handles a regular escape", () => {
  const n = JSON.parse<Named>('{"name":"hello\\n\\\\","value":3}');
  expect(n.name).toBe("hello\n\\");
  expect(n.value).toBe(3);
});

// ─── naive/object.ts: trailing whitespace in deserializeObject ────────────────
// deserializeObject trims trailing whitespace before validating the closing `}`.
// Passes trailing spaces → covers the trim Loop and Assignment at lines 59-60.

describe("NAIVE: JSON.Obj with trailing whitespace covers deserializeObject trim loop", () => {
  const obj = JSON.parse<JSON.Obj>('{"a":1}   ');
  expect(obj.size).toBe(1);
  expect(obj.getAs<f64>("a")).toBe(1.0);
});

// ─── naive/object.ts: trailing whitespace in deserializeJsonArray ─────────────
// Same pattern but for JSON.Arr — covers trim Loop and Assignment at lines 89-90.

describe("NAIVE: JSON.Arr with trailing whitespace covers deserializeJsonArray trim loop", () => {
  const arr = JSON.parse<JSON.Arr>("[1,2,3]   ");
  expect(arr.length).toBe(3);
  expect(arr.at(0).get<f64>()).toBe(1.0);
});

// ─── naive/object.ts: parseArrayBodySlots return-srcEnd ──────────────────────
// deserializeJsonArray validates the first/last chars ('['/']') but does NOT
// require them to match. For '[[1,2]' the last char IS ']' (valid), but it
// belongs to the inner array — the outer loop exhausts srcStart without finding
// the outer ']', hitting the `return srcEnd` path at line 129. All modes call
// the same naive deserializeJsonArray for JSON.Arr.

describe("NAIVE: JSON.Arr with outer missing ']' covers parseArrayBodySlots return-srcEnd", () => {
  const arr = JSON.parse<JSON.Arr>("[[1,2]");
  expect(arr.length).toBe(1);
});

// ─── swar/array/shared.ts: backslash in string element → scanQuotedValueEnd ──
// deserializeGenericArrayBody calls scanValueEnd for each JSON.Value[] element.
// A string element containing '\n' (backslash+n) triggers scanQuotedValueEnd_SWAR
// to find a backslash in the SWAR block (line 90: break), then fall through to
// the byte-by-byte tail loop (lines 96-100) to locate the closing quote.

describe("SWAR: JSON.Value[] field with escaped string covers scanQuotedValueEnd_SWAR backslash+tail path", () => {
  const h = JSON.parse<ValueArrHolder>('{"vals":["hello\\nworld"]}');
  expect(h.vals.length).toBe(1);
  expect(h.vals[0].get<string>()).toBe("hello\nworld");
});

// ─── swar/float.ts + simd/float.ts: expDigits == 0 return expStart ───────────
// A struct float field like "1e," has a bare exponent with no following digits.
// In SWAR/SIMD mode the field parser reaches the `if (expDigits == 0)` guard and
// returns expStart (the fallback picks up `1` as the value). NAIVE mode uses
// scanFloatEnd + f64.parse which is lenient, so no throw in any mode.

describe("SWAR/SIMD: float field with bare exponent (no digits) covers expDigits==0 return path", () => {
  const v = JSON.parse<Vec2>('{"x":1e,"y":0}');
  expect(v.y).toBe(0.0);
});

// ─── simd/float.ts: 16-digit SIMD mantissa stride loop ───────────────────────
// deserializeFloat_SIMD enters the `while (p+30 < srcEnd && intDigits+fracDigits<=3)`
// loop only when the fractional part has ≥16 digits ahead. A 35-digit mantissa
// satisfies both guards and drives the loop body (lines 79-84: Block, Loop,
// LogicalBranch, three Assignments). NAIVE and SWAR modes parse the same input
// without that loop; they do not throw.

describe("SIMD: very long float covers 16-digit SIMD mantissa stride loop (lines 79-84)", () => {
  const v = JSON.parse<f64>("1.12345678901234567890123456789012345");
  expect(v > 1.0).toBe(true);
  expect(v < 2.0).toBe(true);
});

// ─── simd/array/integer.ts: deserializeNarrowIntegerArray_SIMD switch cases ──
// The narrow-u8 SIMD path loads a v128 block from srcStart and switches on the
// comma bitmask.  Case 0x48 (3+2 layout) is covered by the main test suite.
// These tests trigger the remaining five cases by using [255,100,...] as a
// prefix: first iteration starts at `[` → bitmask 0x10, no case, scalar skip.
// Second iteration starts at `2` (of 255) → block `255,100,` → commas at
// lanes 3,7 → bitmask 0x88 → case fires, consumes 16 bytes.  Third iteration
// starts at the target pair with the designated comma layout.

describe("SIMD: u8[] narrow-array case 0x88 (3+3 digit pair) covered by [255,100,5]", () => {
  const a = JSON.parse<u8[]>("[255,100,5]");
  expect(a.length).toBe(3);
  expect(a[0]).toBe(255);
  expect(a[1]).toBe(100);
  expect(a[2]).toBe(5);
});

describe("SIMD: u8[] narrow-array case 0x44 (2+3 digit pair) covered by [255,100,12,123,5]", () => {
  const a = JSON.parse<u8[]>("[255,100,12,123,5]");
  expect(a.length).toBe(5);
  expect(a[0]).toBe(255);
  expect(a[1]).toBe(100);
  expect(a[2]).toBe(12);
  expect(a[3]).toBe(123);
  expect(a[4]).toBe(5);
});

describe("SIMD: u8[] narrow-array case 0x24 (2+2 digit pair) covered by [255,100,12,34,50]", () => {
  const a = JSON.parse<u8[]>("[255,100,12,34,50]");
  expect(a.length).toBe(5);
  expect(a[0]).toBe(255);
  expect(a[1]).toBe(100);
  expect(a[2]).toBe(12);
  expect(a[3]).toBe(34);
  expect(a[4]).toBe(50);
});

describe("SIMD: u8[] narrow-array case 0x28 (3+1 digit pair) covered by [255,100,123,4,50]", () => {
  const a = JSON.parse<u8[]>("[255,100,123,4,50]");
  expect(a.length).toBe(5);
  expect(a[0]).toBe(255);
  expect(a[1]).toBe(100);
  expect(a[2]).toBe(123);
  expect(a[3]).toBe(4);
  expect(a[4]).toBe(50);
});

describe("SIMD: u8[] narrow-array case 0x22 (1+3 digit pair) covered by [255,100,1,234,50]", () => {
  const a = JSON.parse<u8[]>("[255,100,1,234,50]");
  expect(a.length).toBe(5);
  expect(a[0]).toBe(255);
  expect(a[1]).toBe(100);
  expect(a[2]).toBe(1);
  expect(a[3]).toBe(234);
  expect(a[4]).toBe(50);
});

// ─── simd/array/integer.ts: parseUnsignedIntegerSIMD SIMD 8-digit loop ───────
// A 9-digit value causes tryParseEightDigitsSIMD to succeed on the first pass
// (first digit consumed separately, then 8 remaining zeros fit one SIMD lane).
// Lines 145-146 (value = next; srcStart += 16) fire on that successful SIMD
// parse.  u32[] routes through parseUnsignedIntegerSIMD (not narrow).

describe("SIMD: u32[] with 9-digit value covers parseUnsignedIntegerSIMD SIMD 8-digit loop", () => {
  const a = JSON.parse<u32[]>("[100000000,5]");
  expect(a.length).toBe(2);
  expect(a[0]).toBe(100000000);
  expect(a[1]).toBe(5);
});

// ─── swar/string.ts + simd/string.ts: escaped field via scalar tail ───────────
// deserializeStringField_SWAR/SIMD has a SWAR/SIMD block loop followed by a
// scalar tail.  For {"x":"\n"} (9 chars = 18 bytes UTF-16), payloadStart lands
// at byte 12 while srcEnd8 = byte 10 (SWAR) and srcEnd16 = byte 2 (SIMD) — so
// the block loops are never entered.  The scalar tail finds `\` at byte 12 and
// calls deserializeEscapedStringField_SWAR/SIMD (lines 537-538 / 430-431).
// Inside those, srcEnd8=10 < escapeStart=12 so the SWAR block also skips; the
// tail at line 347 / within the escaped SIMD tail processes the \n escape.

describe("SWAR/SIMD: short escaped field via scalar tail covers deserializeStringField backslash path", () => {
  const v = JSON.parse<S1>('{"x":"\\n"}');
  expect(v.x.length).toBe(1);
  expect(v.x.charCodeAt(0)).toBe(10);
});

// ─── simd/string.ts: deserializeEscapedStringField_SIMD bulk-copy inner loop ─
// After processing \n, the function streams the first clean 16-byte block
// cheaply, then checks whether the NEXT block is also clean (lines 285-291).
// With 47 A's after \n and srcEnd positioned past the trailing `"}`, the inner
// while loop (line 294) runs for three clean b3 blocks (line 302 fires each
// time) and then hits the closing `"` in the fourth block (line 301 break),
// after which a single memory.copy covers the entire clean run (line 306).

describe("SIMD: escaped field with 47-char clean run covers deserializeEscapedStringField_SIMD bulk-copy loop", () => {
  const v = JSON.parse<Named>(
    '{"name":"\\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}',
  );
  expect(v.name.length).toBe(48);
  expect(v.name.charCodeAt(0)).toBe(10);
  expect(v.name.charCodeAt(1)).toBe(65);
});

// ─── simd/array/integer.ts: reuse path with 9-digit value ─────────────────────
// When JSON.parse is called with an existing array (reusableLength != 0), the
// do-while reuse block at lines 402-503 runs.  A 9-digit value triggers the
// SIMD 8-digit sub-loop: lines 473-474 (unsigned) and 434-435 (signed).

describe("SIMD: u32[] reuse path with 9-digit value covers reuse unsigned SIMD loop (lines 473-474)", () => {
  const existing = new Array<u32>(3);
  existing[0] = 0;
  existing[1] = 0;
  existing[2] = 0;
  const a = JSON.parse<u32[]>("[100000000]", existing);
  expect(a.length).toBe(1);
  expect(a[0]).toBe(100000000);
});

describe("SIMD: i32[] reuse path with 9-digit value covers reuse signed SIMD loop (lines 434-435)", () => {
  const existing = new Array<i32>(3);
  existing[0] = 0;
  existing[1] = 0;
  existing[2] = 0;
  const a = JSON.parse<i32[]>("[100000000]", existing);
  expect(a.length).toBe(1);
  expect(a[0]).toBe(100000000);
});

// ─── simd/string.ts: deserializeStringField_SIMD scalar tail backslash ────────
// With 9 a's before \n, the SIMD 16-byte loop scans [ptr+12,ptr+28) (8 a's,
// clean), advances srcStart to ptr+28 > srcEnd16=ptr+22, then exits. The scalar
// tail at ptr+28 walks through `a` at ptr+28, then hits `\` at ptr+30.
// Lines 430-431 in deserializeStringField_SIMD fire (verified already by the
// S1 \\n test, re-confirmed here for SIMD scalar tail clarity).

describe("SIMD: 9-a prefix before \\n triggers scalar tail backslash in deserializeStringField_SIMD", () => {
  const v = JSON.parse<S1>('{"x":"aaaaaaaaa\\n"}');
  expect(v.x.length).toBe(10);
  expect(v.x.charCodeAt(9)).toBe(10);
});

// ─── assembly/index.ts: JSON.Value.getType returns Null for Array<i32> ─────────
// getType<T> falls through all isinstance checks for Array<i32> (not a primitive,
// not JSON.Value[], not a TypedArray, etc.) and returns JSON.Types.Null at
// line 1017.

// Named is a @json class with __SERIALIZE; but Named[] (the Array wrapper)
// does NOT have __SERIALIZE. getType<Named[]> falls through every branch and
// reaches line 1017.
describe("JSON.Value.getType<Named[]> falls through all branches → returns Null (index.ts:1017)", () => {
  const v = JSON.Value.from<i32>(0);
  const arr = new Array<Named>(0);
  expect(v.getType<Named[]>(arr)).toBe(JSON.Types.Null);
});

// ─── simd/float.ts:81: parse16Digits boundary break ───────────────────────────
// For "1.23456789012345e6": intDigits=1, fracDigits=0, so
// (intDigits+fracDigits<=3) is TRUE and (p+30 < srcEnd) is TRUE (32 bytes
// remain). parse16Digits_SIMD reads 16 chars "23456789012345e6"; the 'e' at
// position 14 is not a digit → parsed==U64.MAX_VALUE → line 81 break → fallback.
// Works in all 3 modes (NAIVE validates and parses via f64.parse; SWAR uses
// parse4 which breaks at a different line already covered).
describe("SIMD: 16-digit parse boundary break covers simd/float.ts:81", () => {
  const v = JSON.parse<f64>("1.23456789012345e6");
  expect(v).toBe(1234567.89012345);
});

// ─── serialize/naive/set.ts:13 Ternary FALSE: u64 set serialization ───────────
// maxIntegerBytes<T>() at line 13 returns 40 (unsigned) for sizeof(T)==8.
// The existing Set<i64> test already covers the signed (42) branch; this covers
// the unsigned (40) FALSE branch via Set<u64>.
describe("Serialize: Set<u64> covers naive/set.ts:13 Ternary false (unsigned 64-bit)", () => {
  const s = new Set<u64>();
  s.add(1);
  const out = JSON.stringify(s);
  expect(out).toBe("[1]");
});
