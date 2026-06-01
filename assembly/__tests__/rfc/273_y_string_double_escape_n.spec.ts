// RFC8259 / JSONTestSuite: y_string_double_escape_n.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_double_escape_n", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\\\n"]');
  }).not.toThrow();
});
