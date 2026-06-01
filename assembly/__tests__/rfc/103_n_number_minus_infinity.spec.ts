// RFC8259 / JSONTestSuite: n_number_minus_infinity.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_minus_infinity", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-Infinity]");
  }).toThrow();
});
