// RFC8259 / JSONTestSuite: n_number_neg_int_starting_with_zero.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_neg_int_starting_with_zero", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-012]");
  }).toThrow();
});
