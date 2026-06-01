// RFC8259 / JSONTestSuite: y_string_utf8.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_utf8", () => {
  expect((): void => {
    JSON.parse<string[]>('["\u20ac\ud834\udd1e"]');
  }).not.toThrow();
});
