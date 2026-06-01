// RFC8259 / JSONTestSuite: y_string_unescaped_char_delete.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_unescaped_char_delete", () => {
  expect((): void => {
    JSON.parse<string[]>('["\u007f"]');
  }).not.toThrow();
});
