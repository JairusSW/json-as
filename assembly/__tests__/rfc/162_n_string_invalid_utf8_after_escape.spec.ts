// RFC8259 / JSONTestSuite: n_string_invalid_utf8_after_escape.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_invalid_utf8_after_escape", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\\ufffd"]');
  }).toThrow();
});
