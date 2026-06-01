// RFC8259 / JSONTestSuite: i_string_incomplete_surrogates_escape_valid.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_incomplete_surrogates_escape_valid", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uD800\\uD800\\n"]');
  }).not.toThrow();
});
