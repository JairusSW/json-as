// RFC8259 / JSONTestSuite: n_number_real_garbage_after_e.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_real_garbage_after_e", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1ea]");
  }).toThrow();
});
