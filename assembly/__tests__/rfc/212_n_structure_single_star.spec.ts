// RFC8259 / JSONTestSuite: n_structure_single_star.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_single_star", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("*");
  }).toThrow();
});
