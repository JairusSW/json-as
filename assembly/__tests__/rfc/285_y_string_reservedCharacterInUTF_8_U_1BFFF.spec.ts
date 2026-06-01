// RFC8259 / JSONTestSuite: y_string_reservedCharacterInUTF-8_U+1BFFF.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_reservedCharacterInUTF-8_U+1BFFF", () => {
  expect((): void => {
    JSON.parse<string[]>('["\ud82f\udfff"]');
  }).not.toThrow();
});
