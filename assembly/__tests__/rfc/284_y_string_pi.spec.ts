// RFC8259 / JSONTestSuite: y_string_pi.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_pi", () => {
  expect((): void => {
    JSON.parse<string[]>('["\u03c0"]');
  }).not.toThrow();
});
