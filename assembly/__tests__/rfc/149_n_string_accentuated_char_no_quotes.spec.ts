// RFC8259 / JSONTestSuite: n_string_accentuated_char_no_quotes.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_accentuated_char_no_quotes", () => {
  expect((): void => {
    JSON.parse<string[]>("[\u00e9]");
  }).toThrow();
});
