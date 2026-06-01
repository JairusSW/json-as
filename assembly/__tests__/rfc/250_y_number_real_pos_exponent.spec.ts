// RFC8259 / JSONTestSuite: y_number_real_pos_exponent.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_real_pos_exponent", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1e+2]");
  }).not.toThrow();
});
