// RFC8259 / JSONTestSuite: y_array_with_1_and_newline.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_array_with_1_and_newline", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1\u000a]");
  }).not.toThrow();
});
