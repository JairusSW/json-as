// RFC8259 / JSONTestSuite: y_object_empty.json  (typed as Map<string, JSON.Value>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_empty", () => {
  expect((): void => {
    JSON.parse<Map<string, JSON.Value>>("{}");
  }).not.toThrow();
});
