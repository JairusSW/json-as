// RFC8259 / JSONTestSuite: y_string_double_escape_a.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_double_escape_a", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\\\a"]');
  }).not.toThrow();
});
