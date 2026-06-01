// RFC8259 / JSONTestSuite: i_string_1st_valid_surrogate_2nd_invalid.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_1st_valid_surrogate_2nd_invalid", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uD888\\u1234"]');
  }).not.toThrow();
});
