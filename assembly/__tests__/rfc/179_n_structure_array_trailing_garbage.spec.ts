// RFC8259 / JSONTestSuite: n_structure_array_trailing_garbage.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_array_trailing_garbage", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1]x");
  }).toThrow();
});
