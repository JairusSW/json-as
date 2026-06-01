// RFC8259 / JSONTestSuite: y_number_after_space.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_after_space", () => {
  expect((): void => {
    JSON.parse<f64[]>("[ 4]");
  }).not.toThrow();
});
