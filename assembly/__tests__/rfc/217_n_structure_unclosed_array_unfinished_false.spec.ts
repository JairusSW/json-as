// RFC8259 / JSONTestSuite: n_structure_unclosed_array_unfinished_false.json  (typed as bool[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_unclosed_array_unfinished_false", () => {
  expect((): void => {
    JSON.parse<bool[]>("[ true, fals");
  }).toThrow();
});
