// RFC8259 / JSONTestSuite: n_string_unescaped_tab.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_unescaped_tab", () => {
  expect((): void => {
    JSON.parse<string[]>('["\u0009"]');
  }).toThrow();
});
