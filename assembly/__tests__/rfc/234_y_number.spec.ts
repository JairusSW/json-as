// RFC8259 / JSONTestSuite: y_number.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number", () => {
  expect((): void => {
    JSON.parse<f64[]>("[123e65]");
  }).not.toThrow();
});
