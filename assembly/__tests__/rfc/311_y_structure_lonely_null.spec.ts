// RFC8259 / JSONTestSuite: y_structure_lonely_null.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_structure_lonely_null", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("null");
  }).not.toThrow();
});
