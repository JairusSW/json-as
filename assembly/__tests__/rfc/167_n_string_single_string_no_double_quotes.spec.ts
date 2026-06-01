// RFC8259 / JSONTestSuite: n_string_single_string_no_double_quotes.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_single_string_no_double_quotes", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("abc");
  }).toThrow();
});
