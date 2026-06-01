// RFC8259 / JSONTestSuite: n_number_invalid+-.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_invalid+-", () => {
  expect((): void => {
    JSON.parse<f64[]>("[0e+-1]");
  }).toThrow();
});
