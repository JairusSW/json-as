// RFC8259 / JSONTestSuite: n_number_expression.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_expression", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1+2]");
  }).toThrow();
});
