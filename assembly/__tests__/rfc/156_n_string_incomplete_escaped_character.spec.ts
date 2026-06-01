// RFC8259 / JSONTestSuite: n_string_incomplete_escaped_character.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_incomplete_escaped_character", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\u00A"]');
  }).toThrow();
});
