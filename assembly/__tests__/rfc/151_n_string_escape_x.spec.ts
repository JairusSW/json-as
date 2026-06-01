// RFC8259 / JSONTestSuite: n_string_escape_x.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_escape_x", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\x00"]');
  }).toThrow();
});
