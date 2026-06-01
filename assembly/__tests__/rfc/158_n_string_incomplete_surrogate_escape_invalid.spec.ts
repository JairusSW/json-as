// RFC8259 / JSONTestSuite: n_string_incomplete_surrogate_escape_invalid.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_incomplete_surrogate_escape_invalid", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uD800\\uD800\\x"]');
  }).toThrow();
});
