// RFC8259 / JSONTestSuite: i_string_invalid_lonely_surrogate.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_invalid_lonely_surrogate", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\ud800"]');
  }).not.toThrow();
});
