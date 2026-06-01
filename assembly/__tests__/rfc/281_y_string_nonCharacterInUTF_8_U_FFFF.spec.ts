// RFC8259 / JSONTestSuite: y_string_nonCharacterInUTF-8_U+FFFF.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_nonCharacterInUTF-8_U+FFFF", () => {
  expect((): void => {
    JSON.parse<string[]>('["\uffff"]');
  }).not.toThrow();
});
