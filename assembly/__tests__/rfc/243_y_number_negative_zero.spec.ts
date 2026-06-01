// RFC8259 / JSONTestSuite: y_number_negative_zero.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_negative_zero", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-0]");
  }).not.toThrow();
});
