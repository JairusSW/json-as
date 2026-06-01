// RFC8259 / JSONTestSuite: y_object_empty_key.json  (typed as Map<string, f64>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_empty_key", () => {
  expect((): void => {
    JSON.parse<Map<string, f64>>('{"":0}');
  }).not.toThrow();
});
