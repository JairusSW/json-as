import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class TinyVec3 {
  x: i32 = 0;
  y: i32 = 0;
  z: i32 = 0;
}


@json
class TinyStringBox {
  s: string = "";
}

function expectTinyStringPayload(json: string, value: string): void {
  expect((json.length < 9).toString()).toBe("true");
  expect(JSON.parse<string>(json)).toBe(value);
  expect(JSON.stringify(value)).toBe(json);
}

function expectSmallJsonPayload(json: string): void {
  expect((json.length <= 9).toString()).toBe("true");
}

describe("Should round-trip tiny string payloads without escapes", () => {
  expectTinyStringPayload('""', "");
  expectTinyStringPayload('"a"', "a");
  expectTinyStringPayload('"ab"', "ab");
  expectTinyStringPayload('"abc"', "abc");
  expectTinyStringPayload('"abcd"', "abcd");
  expectTinyStringPayload('"abcde"', "abcde");
  expectTinyStringPayload('"abcdef"', "abcdef");
});

describe("Should round-trip tiny string payloads with single escapes", () => {
  expectTinyStringPayload('"\\n"', "\n");
  expectTinyStringPayload('"\\t"', "\t");
  expectTinyStringPayload('"\\r"', "\r");
  expectTinyStringPayload('"\\b"', "\b");
  expectTinyStringPayload('"\\f"', "\f");
  expectTinyStringPayload('"\\\\"', "\\");
  expectTinyStringPayload('"\\""', '"');
  expect(('"\\u03a9"'.length < 9).toString()).toBe("true");
  expect(JSON.parse<string>('"\\u03a9"')).toBe("Ω");
  expect(JSON.stringify("Ω")).toBe('"Ω"');
});

describe("Should round-trip tiny string payloads with short mixed content", () => {
  expectTinyStringPayload('"a\\n"', "a\n");
  expectTinyStringPayload('"a\\t"', "a\t");
  expectTinyStringPayload('"a\\r"', "a\r");
  expectTinyStringPayload('"a\\\\"', "a\\");
  expectTinyStringPayload('"a\\""', 'a"');
  expectTinyStringPayload('"\\na"', "\na");
  expectTinyStringPayload('"\\\\a"', "\\a");
  expectTinyStringPayload('"\\"a"', '"a');
});

describe("Should handle tiny non-string payloads and containers", () => {
  expect((JSON.stringify<bool>(true).length < 9).toString()).toBe("true");
  expect((JSON.stringify<bool>(false).length < 9).toString()).toBe("true");
  expect((JSON.stringify<i32>(0).length < 9).toString()).toBe("true");
  expect((JSON.stringify<i32>(-1).length < 9).toString()).toBe("true");
  expect((JSON.stringify<f64>(1.5).length < 9).toString()).toBe("true");
  expect((JSON.stringify<f64>(1e-7).length < 9).toString()).toBe("true");
  expect((JSON.stringify<JSON.Raw>(JSON.Raw.from("[]")).length < 9).toString()).toBe("true");

  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<i32>("-1"))).toBe("-1");
  expect(JSON.stringify(JSON.parse<i32>("7"))).toBe("7");
  expect(JSON.stringify(JSON.parse<f64>("1.5"))).toBe("1.5");
  expect(JSON.parse<f64>("1e-7").toString()).toBe((1e-7).toString());
  expect(JSON.stringify(JSON.parse<JSON.Raw>("[]"))).toBe("[]");
  expect(JSON.stringify(JSON.parse<JSON.Raw>("{}"))).toBe("{}");
});

describe("Should handle tiny arrays and tiny objects", () => {
  expect((JSON.stringify<i32[]>([]).length < 9).toString()).toBe("true");
  expect((JSON.stringify<i32[]>([1]).length < 9).toString()).toBe("true");
  expect((JSON.stringify<i32[]>([1, 2]).length < 9).toString()).toBe("true");
  expect((JSON.stringify<JSON.Value>(JSON.parse<JSON.Value>("[]")).length < 9).toString()).toBe("true");
  expect((JSON.stringify<JSON.Value>(JSON.parse<JSON.Value>("{}")).length < 9).toString()).toBe("true");

  expect(JSON.stringify(JSON.parse<i32[]>("[]"))).toBe("[]");
  expect(JSON.stringify(JSON.parse<i32[]>("[1]"))).toBe("[1]");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2]"))).toBe("[1,2]");
  expect(JSON.stringify(JSON.parse<JSON.Value>("[]"))).toBe("[]");
  expect(JSON.stringify(JSON.parse<JSON.Value>("{}"))).toBe("{}");
  expect(JSON.stringify(JSON.parse<JSON.Value>("0"))).toBe("0.0");
  expect(JSON.stringify(JSON.parse<JSON.Value>("1"))).toBe("1.0");
  expect(JSON.stringify(JSON.parse<JSON.Value>('"a"'))).toBe('"a"');
  expect(JSON.stringify(JSON.parse<JSON.Value>("true"))).toBe("true");
});

describe("Should handle tiny struct payloads", () => {
  expectSmallJsonPayload('{"x":1}');
  expectSmallJsonPayload('{"y":2}');
  expectSmallJsonPayload('{"z":3}');
  const parsed = JSON.parse<TinyVec3>('{"x":1}');
  expect(parsed.x.toString()).toBe("1");
  expect(parsed.y.toString()).toBe("0");
  expect(parsed.z.toString()).toBe("0");
  expect(JSON.stringify(parsed)).toBe('{"x":1,"y":0,"z":0}');

  const parsedY = JSON.parse<TinyVec3>('{"y":2}');
  expect(parsedY.x.toString()).toBe("0");
  expect(parsedY.y.toString()).toBe("2");
  expect(parsedY.z.toString()).toBe("0");

  const parsedZ = JSON.parse<TinyVec3>('{"z":3}');
  expect(parsedZ.x.toString()).toBe("0");
  expect(parsedZ.y.toString()).toBe("0");
  expect(parsedZ.z.toString()).toBe("3");
});

describe("Should handle tiny object payloads with short strings", () => {
  expectSmallJsonPayload('{"s":""}');
  expectSmallJsonPayload('{"s":"a"}');

  const empty = JSON.parse<TinyStringBox>('{"s":""}');
  expect(empty.s).toBe("");
  expect(JSON.stringify(empty)).toBe('{"s":""}');

  const single = JSON.parse<TinyStringBox>('{"s":"a"}');
  expect(single.s).toBe("a");
  expect(JSON.stringify(single)).toBe('{"s":"a"}');
});
