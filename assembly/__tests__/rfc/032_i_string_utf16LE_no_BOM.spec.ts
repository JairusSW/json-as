// RFC8259 / JSONTestSuite: i_string_utf16LE_no_BOM.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_utf16LE_no_BOM", () => {
  expect((): void => {
    JSON.parse<string[]>('[\u0000"\u0000\ufffd\u0000"\u0000]\u0000');
  }).not.toThrow();
});
