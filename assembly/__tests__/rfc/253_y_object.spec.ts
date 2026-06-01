// RFC8259 / JSONTestSuite: y_object.json  (typed as Map<string, string>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object", () => {
  expect((): void => {
    JSON.parse<Map<string, string>>('{"asd":"sdf", "dfg":"fgh"}');
  }).not.toThrow();
});
