// RFC8259 / JSONTestSuite: y_number_0e+1.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_0e+1", () => {
  expect((): void => {
    JSON.parse<f64[]>("[0e+1]");
  }).not.toThrow();
});
