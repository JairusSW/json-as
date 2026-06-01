// RFC8259 / JSONTestSuite: y_object_duplicated_key_and_value.json  (typed as Map<string, string>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_duplicated_key_and_value", () => {
  expect((): void => {
    JSON.parse<Map<string, string>>('{"a":"b","a":"b"}');
  }).not.toThrow();
});
