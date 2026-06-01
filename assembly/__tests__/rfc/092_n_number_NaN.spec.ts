// RFC8259 / JSONTestSuite: n_number_NaN.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_NaN", () => {
  expect((): void => {
    JSON.parse<f64[]>("[NaN]");
  }).toThrow();
});
