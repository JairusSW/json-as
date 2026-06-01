// RFC8259 / JSONTestSuite: y_number_real_exponent.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_real_exponent", () => {
  expect((): void => {
    JSON.parse<f64[]>("[123e45]");
  }).not.toThrow();
});
