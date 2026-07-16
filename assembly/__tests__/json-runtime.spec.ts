import { fromRaw, JSON, toBox, toRaw } from "..";
import { describe, expect } from "as-test";
import { bs } from "../../lib/as-bs";
import { Vec3 } from "./types";

describe("Should cover JSON.Value type creation broadly", () => {
  const values = [
    JSON.Value.from("text"),
    JSON.Value.from(true),
    JSON.Value.from(false),
    JSON.Value.from(0),
    JSON.Value.from(123),
    JSON.Value.from(3.5),
    JSON.Value.from(new Vec3()),
  ];

  expect(values[0].type.toString()).toBe(JSON.Types.String.toString());
  expect(values[1].type.toString()).toBe(JSON.Types.Bool.toString());
  expect(values[2].type.toString()).toBe(JSON.Types.Bool.toString());
  expect(values[3].toString()).toBe("0");
  expect(values[4].toString()).toBe("123");
  expect(values[5].toString()).toBe("3.5");
  expect(values[6].toString()).toBe('{"x":1,"y":2,"z":3}');
});

describe("Should preserve signed integer tags in JSON.Value", () => {
  const negative = JSON.Value.from<i32>(-42);
  const obj = new JSON.Obj();
  obj.set("n", -42);

  expect(negative.type.toString()).toBe(JSON.Types.I32.toString());
  expect(negative.toString()).toBe("-42");
  expect(JSON.stringify(negative)).toBe("-42");
  expect(JSON.stringify(obj)).toBe('{"n":-42}');
});

describe("Should mutate JSON.Obj instances deeply", () => {
  const root = new JSON.Obj();
  const inner = new JSON.Obj();
  const meta = new JSON.Obj();

  root.set("name", "json-as");
  root.set("enabled", true);
  root.set("count", 3);
  inner.set("a", 1);
  inner.set("b", 2);
  meta.set("inner", inner);
  root.set("meta", meta);

  expect(root.has("name").toString()).toBe("true");
  expect(root.get("name")!.get<string>()).toBe("json-as");
  expect(root.get("enabled")!.get<bool>().toString()).toBe("true");
  expect(root.get("count")!.toString()).toBe("3");
  expect(
    root
      .get("meta")!
      .get<JSON.Obj>()
      .get("inner")!
      .get<JSON.Obj>()
      .get("a")!
      .toString(),
  ).toBe("1");
  expect(
    root
      .get("meta")!
      .get<JSON.Obj>()
      .get("inner")!
      .get<JSON.Obj>()
      .get("b")!
      .toString(),
  ).toBe("2");

  root.delete("count");
  expect(root.has("count").toString()).toBe("false");
  expect(JSON.stringify(root)).toBe(
    '{"name":"json-as","enabled":true,"meta":{"inner":{"a":1,"b":2}}}',
  );
});

describe("Should build JSON.Obj values from serializable objects", () => {
  const typed = new Vec3();
  const fromStruct = JSON.Obj.from(typed);
  const fromMap = JSON.Obj.from(new Map<string, i32>().set("x", 7).set("y", 9));

  expect(fromStruct.get("x")!.toString()).toBe("1.0");
  expect(fromStruct.get("z")!.toString()).toBe("3.0");
  expect(fromMap.get("x")!.toString()).toBe("7");
  expect(fromMap.get("y")!.toString()).toBe("9");
});

describe("Should cover JSON.Box conversions through JSON.Value", () => {
  const nullBox = JSON.Box.fromValue<i32>(JSON.parse<JSON.Value>("null"));
  const intBox = JSON.Box.fromValue<i32>(JSON.parse<JSON.Value>("42"));
  const boolBox = JSON.Box.fromValue<bool>(JSON.parse<JSON.Value>("true"));

  expect((nullBox == null).toString()).toBe("true");
  expect((intBox == null).toString()).toBe("false");
  expect(intBox!.value.toString()).toBe("42");
  expect((boolBox == null).toString()).toBe("false");
  expect(boolBox!.value.toString()).toBe("true");
});

describe("Should preserve JSON.Raw in arrays and maps", () => {
  const rawArray = JSON.parse<JSON.Raw[]>('[{"x":1},[1,2,3],"abc",false,null]');
  expect(rawArray.length.toString()).toBe("5");
  expect(rawArray[0].toString()).toBe('{"x":1}');
  expect(rawArray[1].toString()).toBe("[1,2,3]");
  expect(rawArray[2].toString()).toBe('"abc"');
  expect(rawArray[3].toString()).toBe("false");
  expect(rawArray[4].toString()).toBe("null");

  const rawMap = JSON.parse<Map<string, JSON.Raw>>(
    '{"obj":{"x":1},"arr":[1,2],"str":"abc","bool":true}',
  );
  expect(rawMap.get("obj")!.toString()).toBe('{"x":1}');
  expect(rawMap.get("arr")!.toString()).toBe("[1,2]");
  expect(rawMap.get("str")!.toString()).toBe('"abc"');
  expect(rawMap.get("bool")!.toString()).toBe("true");
});

describe("Should traverse parsed arbitrary runtime structures", () => {
  const parsed = JSON.parse<JSON.Value>(
    '{"items":[{"kind":"a","value":1},{"kind":"b","value":[2,3]}],"ok":true}',
  );
  const root = parsed.get<JSON.Obj>();
  const items = root.get("items")!.get<JSON.Arr>();

  expect(root.get("ok")!.get<bool>().toString()).toBe("true");
  expect(items.length.toString()).toBe("2");
  expect(items.at(0).get<JSON.Obj>().get("kind")!.get<string>()).toBe("a");
  expect(items.at(0).get<JSON.Obj>().get("value")!.get<f64>().toString()).toBe(
    "1.0",
  );
  expect(items.at(1).get<JSON.Obj>().get("kind")!.get<string>()).toBe("b");

  const nested = items.at(1).get<JSON.Obj>().get("value")!.get<JSON.Arr>();
  expect(nested.length.toString()).toBe("2");
  expect(nested.at(0).get<f64>().toString()).toBe("2.0");
  expect(nested.at(1).get<f64>().toString()).toBe("3.0");
  expect(JSON.stringify(parsed)).toBe(
    '{"items":[{"kind":"a","value":1},{"kind":"b","value":[2,3]}],"ok":true}',
  );
});

describe("Should preserve bs state for JSON.internal helpers", () => {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  bs.proposeSize(16);
  bs.offset += 6;

  const beforeStringifyOffset = bs.offset;
  const beforeStringifyStack = bs.stackSize;
  const serialized = JSON.internal.stringify<JSON.Value[]>([
    JSON.Value.from(1),
    JSON.Value.from(true),
  ]);

  expect(serialized).toBe("[1,true]");
  expect(bs.offset).toBe(beforeStringifyOffset);
  expect(bs.stackSize).toBe(beforeStringifyStack);

  const beforeParseOffset = bs.offset;
  const beforeParseStack = bs.stackSize;
  const parsed = JSON.internal.parse<JSON.Value>('{"x":1,"y":true}');
  const parsedObj = parsed.get<JSON.Obj>();

  expect(parsedObj.get("x")!.get<f64>().toString()).toBe("1.0");
  expect(parsedObj.get("y")!.get<bool>().toString()).toBe("true");
  expect(JSON.internal.stringify(parsed)).toBe('{"x":1,"y":true}');
  expect(bs.offset).toBe(beforeParseOffset);
  expect(bs.stackSize).toBe(beforeParseStack);

  bs.offset = bs.buffer;
  bs.stackSize = 0;
});

describe("Should cover additional JSON runtime helpers", () => {
  JSON.Memory.shrink();

  const raw = JSON.Raw.from('{"x":1}');
  expect(raw.toString()).toBe('{"x":1}');
  raw.set("[1,2,3]");
  expect(raw.toString()).toBe("[1,2,3]");
  expect(fromRaw(toRaw("true"))).toBe("true");

  const same = JSON.Value.from(JSON.Value.from("x"));
  expect(same.get<string>()).toBe("x");

  const nullable = JSON.Value.from<JSON.Box<i32> | null>(null);
  expect((nullable.asBox<i32>() == null).toString()).toBe("true");
  expect(JSON.Value.from(42).asBox<i32>()!.value.toString()).toBe("42");

  const missing = new JSON.Obj();
  expect((missing.get("absent") == null).toString()).toBe("true");

  const baseObj = new JSON.Obj();
  baseObj.set("k", "v");
  const fromObj = JSON.Obj.from(baseObj);
  expect(fromObj.get("k")!.get<string>()).toBe("v");

  const boxed = toBox(12);
  expect(boxed.value.toString()).toBe("12");
  boxed.set(34);
  expect(boxed.toString()).toBe("34");

  const range = '  {"a":[1,"x"]}  ';
  const start = changetype<usize>(range);
  const end = start + (range.length << 1);
  const valueEnd = JSON.Util.scanValueEnd<JSON.Value>(start, end);
  expect(valueEnd).toBe(end - 4);
  expect(JSON.Util.ptrToStr(start + 4, valueEnd)).toBe('{"a":[1,"x"]}');

  const quoted = '  "a\\\\\\"b" ,';
  const quotedStart = changetype<usize>(quoted);
  const quotedEnd = quotedStart + (quoted.length << 1);
  const quotedValueStart = JSON.Util.skipWhitespace(quotedStart, quotedEnd);
  const quotedValueEnd = JSON.Util.scanValueEnd<string>(quotedStart, quotedEnd);
  expect(JSON.Util.ptrToStr(quotedValueStart, quotedValueEnd)).toBe(
    '"a\\\\\\"b"',
  );

  const array = ' [1,{"x":"}"}] }';
  const arrayStart = changetype<usize>(array);
  const arrayEnd = arrayStart + (array.length << 1);
  const arrayValueStart = JSON.Util.skipWhitespace(arrayStart, arrayEnd);
  const arrayValueEnd = JSON.Util.scanValueEnd<i32[]>(arrayStart, arrayEnd);
  expect(JSON.Util.ptrToStr(arrayValueStart, arrayValueEnd)).toBe(
    '[1,{"x":"}"}]',
  );

  const scalar = "  12345,";
  const scalarStart = changetype<usize>(scalar);
  const scalarEnd = scalarStart + (scalar.length << 1);
  const scalarValueStart = JSON.Util.skipWhitespace(scalarStart, scalarEnd);
  const scalarValueEnd = JSON.Util.scanValueEnd<i32>(scalarStart, scalarEnd);
  expect(JSON.Util.ptrToStr(scalarValueStart, scalarValueEnd)).toBe("12345");
});

describe("Should cover JSON.Value type dispatch more broadly", () => {
  const values = [
    JSON.Value.from<i8>(-8),
    JSON.Value.from<i16>(-16),
    JSON.Value.from<i64>(-64),
    JSON.Value.from<i32>(8),
    JSON.Value.from<u32>(16),
    JSON.Value.from<u32>(32),
    JSON.Value.from<f64>(64.0),
    JSON.Value.from<f32>(1.25),
    JSON.Value.from(new Int8Array(2)),
    JSON.Value.from(new Uint8ClampedArray(2)),
    JSON.Value.from(new Int16Array(2)),
    JSON.Value.from(new Uint16Array(2)),
    JSON.Value.from(new Int32Array(2)),
    JSON.Value.from(new Uint32Array(2)),
    JSON.Value.from(new Int64Array(2)),
    JSON.Value.from(new Uint64Array(2)),
    JSON.Value.from(new Float32Array(2)),
    JSON.Value.from(new Float64Array(2)),
    JSON.Value.from(JSON.Raw.from("[1,2]")),
    JSON.Value.from<JSON.Value[]>([JSON.Value.from(1), JSON.Value.from(true)]),
    JSON.Value.from(new ArrayBuffer(2)),
    JSON.Value.from(JSON.Obj.from(new Map<string, i32>().set("x", 1))),
    JSON.Value.from<JSON.Raw | null>(null),
  ];

  expect(values[0].toString()).toBe("-8");
  expect(values[1].toString()).toBe("-16");
  expect(values[2].toString()).toBe("-64");
  expect(values[3].toString()).toBe("8");
  expect(values[4].toString()).toBe("16");
  expect(values[5].toString()).toBe("32");
  expect(values[6].toString()).toBe("64.0");
  expect(values[7].toString()).toBe("1.25");
  expect(values[18].toString()).toBe("[1,2]");
  expect(values[19].toString()).toBe("[1,true]");
  expect(values[22].toString()).toBe("null");

  const emptyArray = JSON.Value.from<JSON.Value[]>([]);
  expect(emptyArray.toString()).toBe("[]");

  const typed = new Uint8Array(0);
  const typedValue = JSON.Value.from(typed);
  expect(typedValue.toString()).toBe("[]");

  const rawBuffer = new ArrayBuffer(0);
  const bufferValue = JSON.Value.from(rawBuffer);
  expect(bufferValue.toString()).toBe("[]");

  const obj = new JSON.Obj();
  obj.set("n", 1);
  expect(JSON.Value.from(obj).toString()).toBe('{"n":1}');

  const quoted = JSON.Value.from("quoted");
  expect(quoted.toString()).toBe('"quoted"');

  const floating = JSON.Value.from<f64>(6.5);
  expect(floating.toString()).toBe("6.5");
});

describe("Should cover runtime error and utility branches", () => {
  const copied = JSON.internal.stringify<i32[]>([1, 2, 3], "stale");
  expect(copied).toBe("[1,2,3]");

  const emptyStart = changetype<usize>("");
  expect(JSON.Util.scanValueEnd<JSON.Value>(emptyStart, emptyStart)).toBe(0);

  const badString = '"unterminated';
  const badStart = changetype<usize>(badString);
  const badEnd = badStart + (badString.length << 1);
  expect(JSON.Util.scanValueEnd<string>(badStart, badEnd)).toBe(0);
});

// ─── helpers ──────────────────────────────────────────────────────────────────

@json
class Vec2CovGap {
  x: f64 = 0;
  y: f64 = 0;
}


@json
class NamedCovGap {
  name: string = "";
  value: i32 = 0;
}


@json
class ObjArr {
  items: JSON.Obj[] = [];
}


@json
class ValueArrHolder {
  vals: JSON.Value[] = [];
}

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

// naive/object.ts line 164 calls boolBits(false) when parsing `false` in an
// arbitrary JSON object (JSON.Obj). This covers the false branch of the Ternary
// `b ? 1 : 0` in JSON.Value.boolBits (index.ts line 914).
describe("JSON.Value: boolBits false branch via JSON.Obj with false value", () => {
  const obj = JSON.parse<JSON.Obj>('{"active":false,"count":1}');
  const val = obj.get("active")!;
  expect(val.get<bool>()).toBe(false);
});

// Parsing a JSON.Obj where at least one value is a string stores that slot
// lazily. Calling values() then hits the slotIsLazy=true branch at line 1691.
describe("JSON.Obj: values() with a string value covers lazy slot branch", () => {
  const obj = JSON.parse<JSON.Obj>('{"name":"alice","count":42}');
  const vals = obj.values();
  expect(vals.length).toBe(2);
});

// Same VAL_BOX64 path as JSON.Arr.storeSlot but for JSON.Obj.storeSlot line
// 1360 — triggered by set<u64> with a value >= VAL_U64_LIMIT.
describe("JSON.Obj: set<u64> with large value covers storeSlot LogicalBranch for boxed u64", () => {
  const obj = new JSON.Obj();
  const big: u64 = 35184372088833; // >= 2^45 → heap-boxed
  obj.set<u64>("big", big);
  expect(obj.getAs<u64>("big")).toBe(big);
});

// Looking up a key with the same length (8 chars) as an existing key but
// different content causes utf16Equals_SIMD to find a mismatch and return false
// (line 147). In NAIVE/SWAR modes the scalar path returns false equivalently.
describe("SIMD: JSON.Obj lookup with same-length mismatched key covers utf16Equals_SIMD false-return path", () => {
  const obj = JSON.parse<JSON.Obj>('{"abcdefgh":1}');
  const result = obj.get("abcdefgi"); // 8 chars, differs only in last → SIMD mismatch
  expect(result).toBeNull();
});

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
  expect(v.getType<Vec2CovGap>(new Vec2CovGap()) >= JSON.Types.Struct).toBe(
    true,
  );
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

describe("SWAR: JSON.Value[] field with empty array covers deserializeGenericArrayBody empty-array return", () => {
  const h = JSON.parse<ValueArrHolder>('{"vals":[]}');
  expect(h.vals.length).toBe(0);
});

// The final ']' belongs to the inner array. Source exhaustion is not a valid
// substitute for the outer array's own closing delimiter.
describe("JSON.Arr rejects an inner array that steals the outer closing bracket", () => {
  expect((): void => {
    JSON.parse<JSON.Arr>("[[1,2]");
  }).toThrow();
});

// swar/array/shared.ts: backslash in string element → scanQuotedValueEnd
// deserializeGenericArrayBody calls scanValueEnd for each JSON.Value[] element.
// A string element containing '\n' (backslash+n) triggers scanQuotedValueEnd_SWAR
// to find a backslash in the SWAR block (line 90: break), then fall through to
// the byte-by-byte tail loop (lines 96-100) to locate the closing quote.
describe("SWAR: JSON.Value[] field with escaped string covers scanQuotedValueEnd_SWAR backslash+tail path", () => {
  const h = JSON.parse<ValueArrHolder>('{"vals":["hello\\nworld"]}');
  expect(h.vals.length).toBe(1);
  expect(h.vals[0].get<string>()).toBe("hello\nworld");
});

// Named is a @json class with __SERIALIZE; but Named[] (the Array wrapper)
// does NOT have __SERIALIZE. getType<Named[]> falls through every branch and
// reaches line 1017.
describe("JSON.Value.getType<NamedCovGap[]> falls through all branches → returns Null (index.ts:1017)", () => {
  const v = JSON.Value.from<i32>(0);
  const arr = new Array<NamedCovGap>(0);
  expect(v.getType<NamedCovGap[]>(arr)).toBe(JSON.Types.Null);
});

// JSON.Obj[] as @json field → deserializeObjectArrayBody
describe("SWAR: JSON.Obj[] as @json class field round-trips", () => {
  const o = JSON.parse<ObjArr>('{"items":[{"x":1},{"y":2}]}');
  expect(o.items.length).toBe(2);
  expect(o.items[0].getAs<f64>("x")).toBe(1.0);
});

describe("SWAR: JSON.Obj[] empty array as @json class field", () => {
  const o = JSON.parse<ObjArr>('{"items":[]}');
  expect(o.items.length).toBe(0);
});

// An inner object must not consume its owner's closing brace and turn source
// exhaustion into a successful parse.
describe("JSON.Obj rejects an inner object that steals the outer closing brace", () => {
  expect((): void => {
    JSON.parse<JSON.Obj>('{"k":{"a":1}');
  }).toThrow();
});

// swar/array/object.ts:51 — shrink path: reusing a JSON.Obj[] with more elements than the new parse
describe("SWAR: JSON.Obj[] field shrink path on reuse (swar/array/object.ts:51)", () => {
  const o1 = JSON.parse<ObjArr>('{"items":[{"x":1},{"x":2}]}');
  const o2 = JSON.parse<ObjArr>('{"items":[{"x":3}]}', o1);
  expect(o2.items.length).toBe(1);
  expect(o2.items[0].getAs<f64>("x")).toBe(3.0);
});
