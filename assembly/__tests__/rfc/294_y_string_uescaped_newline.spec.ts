// RFC8259 / JSONTestSuite: y_string_uescaped_newline.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_uescaped_newline", () => {
  expect((): void => {
    JSON.parse<string[]>('["new\\u000Aline"]');
  }).not.toThrow();
});
