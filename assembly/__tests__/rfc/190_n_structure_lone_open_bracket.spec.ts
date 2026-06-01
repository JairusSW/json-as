// RFC8259 / JSONTestSuite: n_structure_lone-open-bracket.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_lone-open-bracket", () => {
  expect((): void => {
    JSON.parse<f64[]>("[");
  }).toThrow();
});
