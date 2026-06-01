// RFC8259 / JSONTestSuite: i_number_double_huge_neg_exp.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_number_double_huge_neg_exp", () => {
  expect((): void => {
    JSON.parse<f64[]>("[123.456e-789]");
  }).not.toThrow();
});
