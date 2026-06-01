// RFC8259 / JSONTestSuite: y_array_empty.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_array_empty", () => {
  expect((): void => {
    JSON.parse<f64[]>("[]");
  }).not.toThrow();
});
