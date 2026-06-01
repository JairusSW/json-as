// RFC8259 / JSONTestSuite: n_number_minus_space_1.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_minus_space_1", () => {
  expect((): void => {
    JSON.parse<f64[]>("[- 1]");
  }).toThrow();
});
