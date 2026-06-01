// RFC8259 / JSONTestSuite: y_number_double_close_to_zero.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_double_close_to_zero", () => {
  expect((): void => {
    JSON.parse<f64[]>(
      "[-0.000000000000000000000000000000000000000000000000000000000000000000000000000001]\u000a",
    );
  }).not.toThrow();
});
