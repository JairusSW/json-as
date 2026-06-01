// RFC8259 / JSONTestSuite: n_string_no_quotes_with_bad_escape.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_no_quotes_with_bad_escape", () => {
  expect((): void => {
    JSON.parse<string[]>("[\\n]");
  }).toThrow();
});
