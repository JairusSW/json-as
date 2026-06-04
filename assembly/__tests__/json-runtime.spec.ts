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
  expect(values[6].toString()).toBe('{"x":1.0,"y":2.0,"z":3.0}');
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
  const items = root.get("items")!.get<JSON.Value[]>();

  expect(root.get("ok")!.get<bool>().toString()).toBe("true");
  expect(items.length.toString()).toBe("2");
  expect(items[0].get<JSON.Obj>().get("kind")!.get<string>()).toBe("a");
  expect(items[0].get<JSON.Obj>().get("value")!.get<f64>().toString()).toBe(
    "1.0",
  );
  expect(items[1].get<JSON.Obj>().get("kind")!.get<string>()).toBe("b");

  const nested = items[1].get<JSON.Obj>().get("value")!.get<JSON.Value[]>();
  expect(nested.length.toString()).toBe("2");
  expect(nested[0].get<f64>().toString()).toBe("2.0");
  expect(nested[1].get<f64>().toString()).toBe("3.0");
  expect(JSON.stringify(parsed)).toBe(
    '{"items":[{"kind":"a","value":1.0},{"kind":"b","value":[2.0,3.0]}],"ok":true}',
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
  expect(JSON.internal.stringify(parsed)).toBe('{"x":1.0,"y":true}');
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
