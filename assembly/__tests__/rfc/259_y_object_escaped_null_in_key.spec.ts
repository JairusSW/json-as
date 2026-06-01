// RFC8259 / JSONTestSuite: y_object_escaped_null_in_key.json  (typed as Map<string, f64>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_escaped_null_in_key", () => {
  expect((): void => {
    JSON.parse<Map<string, f64>>('{"foo\\u0000bar": 42}');
  }).not.toThrow();
});
