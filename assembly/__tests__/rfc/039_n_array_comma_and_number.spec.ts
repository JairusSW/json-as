// RFC8259 / JSONTestSuite: n_array_comma_and_number.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_comma_and_number", () => {
  expect((): void => {
    JSON.parse<f64[]>("[,1]");
  }).toThrow();
});
