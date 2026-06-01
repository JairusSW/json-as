// RFC8259 / JSONTestSuite: i_string_invalid_surrogate.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_invalid_surrogate", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\ud800abc"]');
  }).not.toThrow();
});
