// RFC8259 / JSONTestSuite: y_structure_true_in_array.json  (typed as bool[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_structure_true_in_array", () => {
  expect((): void => {
    JSON.parse<bool[]>("[true]");
  }).not.toThrow();
});
