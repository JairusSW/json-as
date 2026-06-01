// RFC8259 / JSONTestSuite: y_object_simple.json  (typed as Map<string, f64[]>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_simple", () => {
  expect((): void => {
    JSON.parse<Map<string, f64[]>>('{"a":[]}');
  }).not.toThrow();
});
