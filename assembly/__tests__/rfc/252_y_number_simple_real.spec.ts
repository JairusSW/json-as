// RFC8259 / JSONTestSuite: y_number_simple_real.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_simple_real", () => {
  expect((): void => {
    JSON.parse<f64[]>("[123.456789]");
  }).not.toThrow();
});
