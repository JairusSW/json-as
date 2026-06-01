// RFC8259 / JSONTestSuite: y_string_unicode_U+1FFFE_nonchar.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_unicode_U+1FFFE_nonchar", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uD83F\\uDFFE"]');
  }).not.toThrow();
});
