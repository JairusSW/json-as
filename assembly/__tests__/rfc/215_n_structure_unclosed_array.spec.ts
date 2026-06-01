// RFC8259 / JSONTestSuite: n_structure_unclosed_array.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_unclosed_array", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1");
  }).toThrow();
});
