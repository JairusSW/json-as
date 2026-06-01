// RFC8259 / JSONTestSuite: n_number_starting_with_dot.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_starting_with_dot", () => {
  expect((): void => {
    JSON.parse<f64[]>("[.123]");
  }).toThrow();
});
