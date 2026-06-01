// RFC8259 / JSONTestSuite: n_number_invalid-negative-real.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_invalid-negative-real", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-123.123foo]");
  }).toThrow();
});
