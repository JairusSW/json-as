// RFC8259 / JSONTestSuite: n_structure_end_array.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_end_array", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("]");
  }).toThrow();
});
