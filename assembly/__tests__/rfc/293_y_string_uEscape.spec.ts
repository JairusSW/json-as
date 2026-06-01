// RFC8259 / JSONTestSuite: y_string_uEscape.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_uEscape", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\u0061\\u30af\\u30EA\\u30b9"]');
  }).not.toThrow();
});
