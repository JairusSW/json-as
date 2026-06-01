// RFC8259 / JSONTestSuite: y_array_ending_with_newline.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_array_ending_with_newline", () => {
  expect((): void => {
    JSON.parse<string[]>('["a"]');
  }).not.toThrow();
});
