// RFC8259 / JSONTestSuite: y_string_unicode.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_unicode", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uA66D"]');
  }).not.toThrow();
});
