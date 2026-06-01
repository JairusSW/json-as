// RFC8259 / JSONTestSuite: n_array_spaces_vertical_tab_formfeed.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_spaces_vertical_tab_formfeed", () => {
  expect((): void => {
    JSON.parse<string[]>('["\u000ba"\\f]');
  }).toThrow();
});
