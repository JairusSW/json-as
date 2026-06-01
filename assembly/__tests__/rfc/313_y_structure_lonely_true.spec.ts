// RFC8259 / JSONTestSuite: y_structure_lonely_true.json  (typed as bool)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_structure_lonely_true", () => {
  expect((): void => {
    JSON.parse<bool>("true");
  }).not.toThrow();
});
