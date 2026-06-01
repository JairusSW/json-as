// RFC8259 / JSONTestSuite: n_number_+Inf.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_+Inf", () => {
  expect((): void => {
    JSON.parse<f64[]>("[+Inf]");
  }).toThrow();
});
