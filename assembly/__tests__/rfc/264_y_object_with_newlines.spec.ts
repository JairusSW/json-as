// RFC8259 / JSONTestSuite: y_object_with_newlines.json  (typed as Map<string, string>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_with_newlines", () => {
  expect((): void => {
    JSON.parse<Map<string, string>>('{\u000a"a": "b"\u000a}');
  }).not.toThrow();
});
