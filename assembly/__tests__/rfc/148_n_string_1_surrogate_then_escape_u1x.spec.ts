// RFC8259 / JSONTestSuite: n_string_1_surrogate_then_escape_u1x.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_1_surrogate_then_escape_u1x", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uD800\\u1x"]');
  }).toThrow();
});
