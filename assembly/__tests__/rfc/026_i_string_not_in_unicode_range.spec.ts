// RFC8259 / JSONTestSuite: i_string_not_in_unicode_range.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_not_in_unicode_range", () => {
  expect((): void => {
    JSON.parse<string[]>('["\ufffd\ufffd\ufffd\ufffd"]');
  }).not.toThrow();
});
