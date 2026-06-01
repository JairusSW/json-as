// RFC8259 / JSONTestSuite: i_string_1st_surrogate_but_2nd_missing.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_1st_surrogate_but_2nd_missing", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uDADA"]');
  }).not.toThrow();
});
