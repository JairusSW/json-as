// RFC8259 / JSONTestSuite: y_string_comments.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_comments", () => {
  expect((): void => {
    JSON.parse<string[]>('["a/*b*/c/*d//e"]');
  }).not.toThrow();
});
