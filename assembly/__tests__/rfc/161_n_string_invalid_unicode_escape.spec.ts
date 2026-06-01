// RFC8259 / JSONTestSuite: n_string_invalid_unicode_escape.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_invalid_unicode_escape", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uqqqq"]');
  }).toThrow();
});
