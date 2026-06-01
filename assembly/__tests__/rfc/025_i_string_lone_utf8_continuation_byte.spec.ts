// RFC8259 / JSONTestSuite: i_string_lone_utf8_continuation_byte.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_lone_utf8_continuation_byte", () => {
  expect((): void => {
    JSON.parse<string[]>('["\ufffd"]');
  }).not.toThrow();
});
