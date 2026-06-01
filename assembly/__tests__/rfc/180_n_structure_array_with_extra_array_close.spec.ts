// RFC8259 / JSONTestSuite: n_structure_array_with_extra_array_close.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_array_with_extra_array_close", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1]]");
  }).toThrow();
});
