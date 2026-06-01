// RFC8259 / JSONTestSuite: n_structure_unclosed_array_partial_null.json  (typed as bool[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_unclosed_array_partial_null", () => {
  expect((): void => {
    JSON.parse<bool[]>("[ false, nul");
  }).toThrow();
});
