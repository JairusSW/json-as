// RFC8259 / JSONTestSuite: y_string_accepted_surrogate_pairs.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_accepted_surrogate_pairs", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\ud83d\\ude39\\ud83d\\udc8d"]');
  }).not.toThrow();
});
