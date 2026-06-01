// RFC8259 / JSONTestSuite: y_structure_lonely_int.json  (typed as f64)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_structure_lonely_int", () => {
  expect((): void => {
    JSON.parse<f64>("42");
  }).not.toThrow();
});
