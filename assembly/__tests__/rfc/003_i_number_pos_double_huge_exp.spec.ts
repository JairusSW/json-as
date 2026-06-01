// RFC8259 / JSONTestSuite: i_number_pos_double_huge_exp.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_number_pos_double_huge_exp", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1.5e+9999]");
  }).not.toThrow();
});
