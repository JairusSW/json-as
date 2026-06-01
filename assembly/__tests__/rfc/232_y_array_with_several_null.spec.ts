// RFC8259 / JSONTestSuite: y_array_with_several_null.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_array_with_several_null", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("[1,null,null,null,2]");
  }).not.toThrow();
});
