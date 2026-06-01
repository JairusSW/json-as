// RFC8259 / JSONTestSuite: y_structure_lonely_false.json  (typed as bool)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_structure_lonely_false", () => {
  expect((): void => {
    JSON.parse<bool>("false");
  }).not.toThrow();
});
