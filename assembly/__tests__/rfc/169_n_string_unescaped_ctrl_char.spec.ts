// RFC8259 / JSONTestSuite: n_string_unescaped_ctrl_char.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_unescaped_ctrl_char", () => {
  expect((): void => {
    JSON.parse<string[]>('["a\u0000a"]');
  }).toThrow();
});
