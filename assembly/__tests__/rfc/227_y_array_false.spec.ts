// RFC8259 / JSONTestSuite: y_array_false.json  (typed as bool[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_array_false", () => {
  expect((): void => {
    JSON.parse<bool[]>("[false]");
  }).not.toThrow();
});
