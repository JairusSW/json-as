// RFC8259 / JSONTestSuite: n_array_number_and_several_commas.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_number_and_several_commas", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1,,]");
  }).toThrow();
});
