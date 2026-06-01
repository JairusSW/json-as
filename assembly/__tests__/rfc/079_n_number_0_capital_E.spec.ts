// RFC8259 / JSONTestSuite: n_number_0_capital_E.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_0_capital_E", () => {
  expect((): void => {
    JSON.parse<f64[]>("[0E]");
  }).toThrow();
});
