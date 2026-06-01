// RFC8259 / JSONTestSuite: i_number_real_underflow.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_number_real_underflow", () => {
  expect((): void => {
    JSON.parse<f64[]>("[123e-10000000]");
  }).not.toThrow();
});
