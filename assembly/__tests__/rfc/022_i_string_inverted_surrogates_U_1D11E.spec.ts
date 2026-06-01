// RFC8259 / JSONTestSuite: i_string_inverted_surrogates_U+1D11E.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_inverted_surrogates_U+1D11E", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uDd1e\\uD834"]');
  }).not.toThrow();
});
