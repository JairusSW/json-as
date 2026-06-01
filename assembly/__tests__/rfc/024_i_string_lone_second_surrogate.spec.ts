// RFC8259 / JSONTestSuite: i_string_lone_second_surrogate.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_lone_second_surrogate", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uDFAA"]');
  }).not.toThrow();
});
