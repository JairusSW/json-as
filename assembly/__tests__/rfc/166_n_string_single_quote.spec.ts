// RFC8259 / JSONTestSuite: n_string_single_quote.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_single_quote", () => {
  expect((): void => {
    JSON.parse<string[]>("['single quote']");
  }).toThrow();
});
