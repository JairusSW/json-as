// RFC8259 / JSONTestSuite: n_number_with_alpha.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_with_alpha", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1.2a-3]");
  }).toThrow();
});
