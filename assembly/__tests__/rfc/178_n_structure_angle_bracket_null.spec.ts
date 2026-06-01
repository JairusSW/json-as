// RFC8259 / JSONTestSuite: n_structure_angle_bracket_null.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_angle_bracket_null", () => {
  expect((): void => {
    JSON.parse<f64[]>("[<null>]");
  }).toThrow();
});
