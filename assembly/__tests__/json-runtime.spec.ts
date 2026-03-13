import { JSON } from "..";
import { describe, expect } from "as-test";
import { Vec3 } from "./types";

describe("Should cover JSON.Value type creation broadly", () => {
  const values = [JSON.Value.from("text"), JSON.Value.from(true), JSON.Value.from(false), JSON.Value.from(0), JSON.Value.from(123), JSON.Value.from(3.5), JSON.Value.from(new Vec3())];

  expect(values[0].type.toString()).toBe(JSON.Types.String.toString());
  expect(values[1].type.toString()).toBe(JSON.Types.Bool.toString());
  expect(values[2].type.toString()).toBe(JSON.Types.Bool.toString());
  expect(values[3].toString()).toBe("0");
  expect(values[4].toString()).toBe("123");
  expect(values[5].toString()).toBe("3.5");
  expect(values[6].toString()).toBe('{"x":1.0,"y":2.0,"z":3.0}');
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
  expect(root.get("meta")!.get<JSON.Obj>().get("inner")!.get<JSON.Obj>().get("a")!.toString()).toBe("1");
  expect(root.get("meta")!.get<JSON.Obj>().get("inner")!.get<JSON.Obj>().get("b")!.toString()).toBe("2");

  root.delete("count");
  expect(root.has("count").toString()).toBe("false");
  expect(JSON.stringify(root)).toBe('{"name":"json-as","enabled":true,"meta":{"inner":{"a":1,"b":2}}}');
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

  const rawMap = JSON.parse<Map<string, JSON.Raw>>('{"obj":{"x":1},"arr":[1,2],"str":"abc","bool":true}');
  expect(rawMap.get("obj")!.toString()).toBe('{"x":1}');
  expect(rawMap.get("arr")!.toString()).toBe("[1,2]");
  expect(rawMap.get("str")!.toString()).toBe('"abc"');
  expect(rawMap.get("bool")!.toString()).toBe("true");
});

describe("Should traverse parsed arbitrary runtime structures", () => {
  const parsed = JSON.parse<JSON.Value>('{"items":[{"kind":"a","value":1},{"kind":"b","value":[2,3]}],"ok":true}');
  const root = parsed.get<JSON.Obj>();
  const items = root.get("items")!.get<JSON.Value[]>();

  expect(root.get("ok")!.get<bool>().toString()).toBe("true");
  expect(items.length.toString()).toBe("2");
  expect(items[0].get<JSON.Obj>().get("kind")!.get<string>()).toBe("a");
  expect(items[0].get<JSON.Obj>().get("value")!.get<f64>().toString()).toBe("1.0");
  expect(items[1].get<JSON.Obj>().get("kind")!.get<string>()).toBe("b");

  const nested = items[1].get<JSON.Obj>().get("value")!.get<JSON.Value[]>();
  expect(nested.length.toString()).toBe("2");
  expect(nested[0].get<f64>().toString()).toBe("2.0");
  expect(nested[1].get<f64>().toString()).toBe("3.0");
  expect(JSON.stringify(parsed)).toBe('{"items":[{"kind":"a","value":1.0},{"kind":"b","value":[2.0,3.0]}],"ok":true}');
});
