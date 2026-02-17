import { JSON } from "..";
import { describe, expect } from "./lib";

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
  expect(JSON.stringify<DataWithEnum>(new DataWithEnum(Enum1.Two))).toBe(
    '{"v":2}',
  );
});

describe("Should deserialize enums", () => {
  const date1 = JSON.parse<Enum1>("2");
  expect(date1).toBe(Enum1.Two);

  const date2 = JSON.parse<Enum1>("0");
  expect(date2).toBe(Enum1.Zero);

  const date3 = JSON.parse<DataWithEnum>('{"v":3}');
  expect(date3.v).toBe(Enum1.Three);
});
