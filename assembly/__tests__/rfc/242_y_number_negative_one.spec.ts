// RFC8259 / JSONTestSuite: y_number_negative_one.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_negative_one", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-1]");
  }).not.toThrow();
});
