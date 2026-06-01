// RFC8259 / JSONTestSuite: n_structure_unclosed_array_unfinished_true.json  (typed as bool[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_unclosed_array_unfinished_true", () => {
  expect((): void => {
    JSON.parse<bool[]>("[ false, tru");
  }).toThrow();
});
