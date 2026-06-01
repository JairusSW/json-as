// RFC8259 / JSONTestSuite: n_number_neg_with_garbage_at_end.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_neg_with_garbage_at_end", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-1x]");
  }).toThrow();
});
