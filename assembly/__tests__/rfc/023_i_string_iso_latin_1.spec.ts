// RFC8259 / JSONTestSuite: i_string_iso_latin_1.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_iso_latin_1", () => {
  expect((): void => {
    JSON.parse<string[]>('["\ufffd"]');
  }).not.toThrow();
});
