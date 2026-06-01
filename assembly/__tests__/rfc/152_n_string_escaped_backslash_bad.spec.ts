// RFC8259 / JSONTestSuite: n_string_escaped_backslash_bad.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_escaped_backslash_bad", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\\\\\"]');
  }).toThrow();
});
