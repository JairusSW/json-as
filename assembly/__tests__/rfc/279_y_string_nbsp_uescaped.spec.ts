// RFC8259 / JSONTestSuite: y_string_nbsp_uescaped.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_nbsp_uescaped", () => {
  expect((): void => {
    JSON.parse<string[]>('["new\\u00A0line"]');
  }).not.toThrow();
});
