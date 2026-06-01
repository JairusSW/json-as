// RFC8259 / JSONTestSuite: y_string_unicodeEscapedBackslash.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_unicodeEscapedBackslash", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\u005C"]');
  }).not.toThrow();
});
