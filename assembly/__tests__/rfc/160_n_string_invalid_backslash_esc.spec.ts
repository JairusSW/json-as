// RFC8259 / JSONTestSuite: n_string_invalid_backslash_esc.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_invalid_backslash_esc", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\a"]');
  }).toThrow();
});
