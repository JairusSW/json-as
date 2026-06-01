// RFC8259 / JSONTestSuite: y_object_string_unicode.json  (typed as Map<string, string>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_string_unicode", () => {
  expect((): void => {
    JSON.parse<Map<string, string>>(
      '{"title":"\\u041f\\u043e\\u043b\\u0442\\u043e\\u0440\\u0430 \\u0417\\u0435\\u043c\\u043b\\u0435\\u043a\\u043e\\u043f\\u0430" }',
    );
  }).not.toThrow();
});
