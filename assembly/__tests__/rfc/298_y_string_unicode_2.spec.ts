// RFC8259 / JSONTestSuite: y_string_unicode_2.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_unicode_2", () => {
  expect((): void => {
    JSON.parse<string[]>('["\u2342\u3234\u2342"]');
  }).not.toThrow();
});
