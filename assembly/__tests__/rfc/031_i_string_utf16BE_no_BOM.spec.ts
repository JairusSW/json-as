// RFC8259 / JSONTestSuite: i_string_utf16BE_no_BOM.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_utf16BE_no_BOM", () => {
  expect((): void => {
    JSON.parse<JSON.Value>('\u0000[\u0000"\u0000\ufffd\u0000"\u0000]');
  }).not.toThrow();
});
