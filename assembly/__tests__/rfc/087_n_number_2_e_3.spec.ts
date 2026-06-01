// RFC8259 / JSONTestSuite: n_number_2.e+3.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_2.e+3", () => {
  expect((): void => {
    JSON.parse<f64[]>("[2.e+3]");
  }).toThrow();
});
