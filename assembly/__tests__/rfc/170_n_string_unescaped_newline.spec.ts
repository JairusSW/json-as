// RFC8259 / JSONTestSuite: n_string_unescaped_newline.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_unescaped_newline", () => {
  expect((): void => {
    JSON.parse<string[]>('["new\u000aline"]');
  }).toThrow();
});
