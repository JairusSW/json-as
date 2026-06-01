// RFC8259 / JSONTestSuite: n_array_incomplete_invalid_value.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_incomplete_invalid_value", () => {
  expect((): void => {
    JSON.parse<f64[]>("[x");
  }).toThrow();
});
