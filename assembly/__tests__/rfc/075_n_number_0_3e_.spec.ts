// RFC8259 / JSONTestSuite: n_number_0.3e+.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_0.3e+", () => {
  expect((): void => {
    JSON.parse<f64[]>("[0.3e+]");
  }).toThrow();
});
