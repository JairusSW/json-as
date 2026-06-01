// RFC8259 / JSONTestSuite: y_string_null_escape.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_null_escape", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\u0000"]');
  }).not.toThrow();
});
