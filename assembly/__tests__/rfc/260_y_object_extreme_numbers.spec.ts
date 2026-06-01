// RFC8259 / JSONTestSuite: y_object_extreme_numbers.json  (typed as Map<string, f64>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_extreme_numbers", () => {
  expect((): void => {
    JSON.parse<Map<string, f64>>('{ "min": -1.0e+28, "max": 1.0e+28 }');
  }).not.toThrow();
});
