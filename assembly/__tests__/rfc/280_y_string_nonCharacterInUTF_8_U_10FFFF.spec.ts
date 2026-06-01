// RFC8259 / JSONTestSuite: y_string_nonCharacterInUTF-8_U+10FFFF.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_nonCharacterInUTF-8_U+10FFFF", () => {
  expect((): void => {
    JSON.parse<string[]>('["\udbff\udfff"]');
  }).not.toThrow();
});
