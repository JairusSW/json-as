// RFC8259 / JSONTestSuite: n_string_start_escape_unclosed.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_start_escape_unclosed", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\');
  }).toThrow();
});
