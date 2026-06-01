// RFC8259 / JSONTestSuite: y_array_null.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_array_null", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("[null]");
  }).not.toThrow();
});
