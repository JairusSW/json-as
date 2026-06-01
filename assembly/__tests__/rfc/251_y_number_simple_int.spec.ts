// RFC8259 / JSONTestSuite: y_number_simple_int.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_simple_int", () => {
  expect((): void => {
    JSON.parse<f64[]>("[123]");
  }).not.toThrow();
});
