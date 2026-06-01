// RFC8259 / JSONTestSuite: n_number_1eE2.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_1eE2", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1eE2]");
  }).toThrow();
});
