// RFC8259 / JSONTestSuite: y_array_heterogeneous.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_array_heterogeneous", () => {
  expect((): void => {
    JSON.parse<JSON.Value>('[null, 1, "1", {}]');
  }).not.toThrow();
});
