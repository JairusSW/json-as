// RFC8259 / JSONTestSuite: n_string_escaped_emoji.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_escaped_emoji", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\\ud83c\udf00"]');
  }).toThrow();
});
