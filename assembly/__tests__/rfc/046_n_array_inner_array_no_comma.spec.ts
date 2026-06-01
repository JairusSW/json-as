// RFC8259 / JSONTestSuite: n_array_inner_array_no_comma.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_inner_array_no_comma", () => {
  expect((): void => {
    JSON.parse<f64[]>("[3[4]]");
  }).toThrow();
});
