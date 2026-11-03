import { JSON } from "..";
import { describe, expect } from "as-test";

describe("static arrays accept ordinary typed-array elements", () => {
  const value = JSON.parse<StaticArray<Uint8Array>>("[[7,8]]");
  expect(value[0][0]).toBe(<u8>7);
  expect(value[0][1]).toBe(<u8>8);
});
