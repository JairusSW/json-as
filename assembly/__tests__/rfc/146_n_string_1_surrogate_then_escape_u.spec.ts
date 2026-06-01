// RFC8259 / JSONTestSuite: n_string_1_surrogate_then_escape_u.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_1_surrogate_then_escape_u", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uD800\\u"]');
  }).toThrow();
});
