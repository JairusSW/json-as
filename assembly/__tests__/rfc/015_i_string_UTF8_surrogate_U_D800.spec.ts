// RFC8259 / JSONTestSuite: i_string_UTF8_surrogate_U+D800.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_UTF8_surrogate_U+D800", () => {
  expect((): void => {
    JSON.parse<string[]>('["\ufffd\ufffd\ufffd"]');
  }).not.toThrow();
});
