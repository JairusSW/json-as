// RFC8259 / JSONTestSuite: n_number_0.1.2.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_0.1.2", () => {
  expect((): void => {
    JSON.parse<f64[]>("[0.1.2]");
  }).toThrow();
});
