// RFC8259 / JSONTestSuite: y_string_unicode_U+FFFE_nonchar.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_unicode_U+FFFE_nonchar", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uFFFE"]');
  }).not.toThrow();
});
