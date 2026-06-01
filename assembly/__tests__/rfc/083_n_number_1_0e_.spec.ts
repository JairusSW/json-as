// RFC8259 / JSONTestSuite: n_number_1.0e-.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_1.0e-", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1.0e-]");
  }).toThrow();
});
