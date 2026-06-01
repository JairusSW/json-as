// RFC8259 / JSONTestSuite: y_string_last_surrogates_1_and_2.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_last_surrogates_1_and_2", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uDBFF\\uDFFF"]');
  }).not.toThrow();
});
