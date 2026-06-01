// RFC8259 / JSONTestSuite: y_object_long_strings.json  (typed as Map<string, JSON.Value>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_long_strings", () => {
  expect((): void => {
    JSON.parse<Map<string, JSON.Value>>(
      '{"x":[{"id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}], "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}',
    );
  }).not.toThrow();
});
