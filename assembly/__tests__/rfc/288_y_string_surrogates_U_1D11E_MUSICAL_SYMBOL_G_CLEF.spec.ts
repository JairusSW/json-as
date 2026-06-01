// RFC8259 / JSONTestSuite: y_string_surrogates_U+1D11E_MUSICAL_SYMBOL_G_CLEF.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_surrogates_U+1D11E_MUSICAL_SYMBOL_G_CLEF", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uD834\\uDd1e"]');
  }).not.toThrow();
});
