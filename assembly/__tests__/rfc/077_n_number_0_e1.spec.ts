// RFC8259 / JSONTestSuite: n_number_0.e1.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_0.e1", () => {
  expect((): void => {
    JSON.parse<f64[]>("[0.e1]");
  }).toThrow();
});
