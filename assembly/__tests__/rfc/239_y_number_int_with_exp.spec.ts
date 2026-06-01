// RFC8259 / JSONTestSuite: y_number_int_with_exp.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_int_with_exp", () => {
  expect((): void => {
    JSON.parse<f64[]>("[20e1]");
  }).not.toThrow();
});
