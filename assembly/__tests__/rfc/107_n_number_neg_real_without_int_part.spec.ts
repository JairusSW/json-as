// RFC8259 / JSONTestSuite: n_number_neg_real_without_int_part.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_neg_real_without_int_part", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-.123]");
  }).toThrow();
});
