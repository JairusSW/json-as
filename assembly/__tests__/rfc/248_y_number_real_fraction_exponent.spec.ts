// RFC8259 / JSONTestSuite: y_number_real_fraction_exponent.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_real_fraction_exponent", () => {
  expect((): void => {
    JSON.parse<f64[]>("[123.456e78]");
  }).not.toThrow();
});
