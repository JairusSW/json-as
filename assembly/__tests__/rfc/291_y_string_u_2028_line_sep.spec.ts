// RFC8259 / JSONTestSuite: y_string_u+2028_line_sep.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_u+2028_line_sep", () => {
  expect((): void => {
    JSON.parse<string[]>('["\u2028"]');
  }).not.toThrow();
});
