// RFC8259 / JSONTestSuite: n_structure_U+2060_word_joined.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_U+2060_word_joined", () => {
  expect((): void => {
    JSON.parse<f64[]>("[\u2060]");
  }).toThrow();
});
