// RFC8259 / JSONTestSuite: n_number_real_without_fractional_part.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_real_without_fractional_part", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1.]");
  }).toThrow();
});
