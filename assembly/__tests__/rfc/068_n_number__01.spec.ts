// RFC8259 / JSONTestSuite: n_number_-01.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_-01", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-01]");
  }).toThrow();
});
