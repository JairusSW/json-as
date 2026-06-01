// RFC8259 / JSONTestSuite: y_array_with_trailing_space.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_array_with_trailing_space", () => {
  expect((): void => {
    JSON.parse<f64[]>("[2] ");
  }).not.toThrow();
});
