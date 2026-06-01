// RFC8259 / JSONTestSuite: n_string_backslash_00.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_backslash_00", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\\u0000"]');
  }).toThrow();
});
