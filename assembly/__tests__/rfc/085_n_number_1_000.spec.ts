// RFC8259 / JSONTestSuite: n_number_1_000.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_1_000", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1 000.0]");
  }).toThrow();
});
