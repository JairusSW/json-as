// RFC8259 / JSONTestSuite: n_number_-2..json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_-2.", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-2.]");
  }).toThrow();
});
