// RFC8259 / JSONTestSuite: i_string_UTF-16LE_with_BOM.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_UTF-16LE_with_BOM", () => {
  expect((): void => {
    JSON.parse<JSON.Value>(
      '\ufffd\ufffd[\u0000"\u0000\ufffd\u0000"\u0000]\u0000',
    );
  }).not.toThrow();
});
