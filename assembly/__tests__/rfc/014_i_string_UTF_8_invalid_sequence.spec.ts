// RFC8259 / JSONTestSuite: i_string_UTF-8_invalid_sequence.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_UTF-8_invalid_sequence", () => {
  expect((): void => {
    JSON.parse<string[]>('["\u65e5\u0448\ufffd"]');
  }).not.toThrow();
});
