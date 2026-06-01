// RFC8259 / JSONTestSuite: y_string_with_del_character.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_with_del_character", () => {
  expect((): void => {
    JSON.parse<string[]>('["a\u007fa"]');
  }).not.toThrow();
});
