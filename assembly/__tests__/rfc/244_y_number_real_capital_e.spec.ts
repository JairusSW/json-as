// RFC8259 / JSONTestSuite: y_number_real_capital_e.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_real_capital_e", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1E22]");
  }).not.toThrow();
});
