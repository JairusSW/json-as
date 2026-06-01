// RFC8259 / JSONTestSuite: y_string_unicode_U+2064_invisible_plus.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_unicode_U+2064_invisible_plus", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\u2064"]');
  }).not.toThrow();
});
