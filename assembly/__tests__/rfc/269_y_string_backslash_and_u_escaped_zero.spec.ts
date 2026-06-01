// RFC8259 / JSONTestSuite: y_string_backslash_and_u_escaped_zero.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_backslash_and_u_escaped_zero", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\\\u0000"]');
  }).not.toThrow();
});
