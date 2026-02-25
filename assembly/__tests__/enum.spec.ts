import { JSON } from "..";
import { describe, expect } from "as-test";

enum Enum1 {
  Zero = 0,
  One = 1,
  Two = 2,
  Three = 3,
}


@json
class DataWithEnum {
  v: Enum1 = Enum1.One;
  constructor(v: Enum1) {
    this.v = v;
  }
}

describe("Should serialize enums", () => {
  expect(JSON.stringify<Enum1>(Enum1.One)).toBe("1");
  expect(JSON.stringify<Enum1>(Enum1.Zero)).toBe("0");
  expect(JSON.stringify<DataWithEnum>(new DataWithEnum(Enum1.Two))).toBe('{"v":2}');
});

describe("Should deserialize enums", () => {
  const date1 = JSON.parse<Enum1>("2");
  expect(date1).toBe(Enum1.Two);

  const date2 = JSON.parse<Enum1>("0");
  expect(date2).toBe(Enum1.Zero);

  const date3 = JSON.parse<DataWithEnum>('{"v":3}');
  expect(date3.v).toBe(Enum1.Three);
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should serialize all enum members", () => {
  expect(JSON.stringify<Enum1>(Enum1.Zero)).toBe("0");
  expect(JSON.stringify<Enum1>(Enum1.One)).toBe("1");
  expect(JSON.stringify<Enum1>(Enum1.Two)).toBe("2");
  expect(JSON.stringify<Enum1>(Enum1.Three)).toBe("3");
});

describe("Should deserialize enum wrappers repeatedly", () => {
  expect(JSON.parse<DataWithEnum>('{"v":0}').v).toBe(Enum1.Zero);
  expect(JSON.parse<DataWithEnum>('{"v":1}').v).toBe(Enum1.One);
  expect(JSON.parse<DataWithEnum>('{"v":2}').v).toBe(Enum1.Two);
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
