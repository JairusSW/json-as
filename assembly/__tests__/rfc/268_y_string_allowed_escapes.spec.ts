// RFC8259 / JSONTestSuite: y_string_allowed_escapes.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_allowed_escapes", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\"\\\\\\/\\b\\f\\n\\r\\t"]');
  }).not.toThrow();
});
