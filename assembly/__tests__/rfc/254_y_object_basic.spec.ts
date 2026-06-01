// RFC8259 / JSONTestSuite: y_object_basic.json  (typed as Map<string, string>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_basic", () => {
  expect((): void => {
    JSON.parse<Map<string, string>>('{"asd":"sdf"}');
  }).not.toThrow();
});
