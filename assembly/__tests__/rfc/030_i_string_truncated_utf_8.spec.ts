// RFC8259 / JSONTestSuite: i_string_truncated-utf-8.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_truncated-utf-8", () => {
  expect((): void => {
    JSON.parse<string[]>('["\ufffd\ufffd"]');
  }).not.toThrow();
});
