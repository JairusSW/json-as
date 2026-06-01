// RFC8259 / JSONTestSuite: n_structure_capitalized_True.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_capitalized_True", () => {
  expect((): void => {
    JSON.parse<f64[]>("[True]");
  }).toThrow();
});
