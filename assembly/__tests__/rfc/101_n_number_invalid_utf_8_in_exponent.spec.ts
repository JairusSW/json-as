// RFC8259 / JSONTestSuite: n_number_invalid-utf-8-in-exponent.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_invalid-utf-8-in-exponent", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1e1\ufffd]");
  }).toThrow();
});
