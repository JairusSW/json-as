// RFC8259 / JSONTestSuite: y_string_unicode_U+FDD0_nonchar.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_unicode_U+FDD0_nonchar", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uFDD0"]');
  }).not.toThrow();
});
