// RFC8259 / JSONTestSuite: n_structure_open_array_comma.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_open_array_comma", () => {
  expect((): void => {
    JSON.parse<f64[]>("[,");
  }).toThrow();
});
