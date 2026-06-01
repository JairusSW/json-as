// RFC8259 / JSONTestSuite: y_number_real_neg_exp.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_real_neg_exp", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1e-2]");
  }).not.toThrow();
});
