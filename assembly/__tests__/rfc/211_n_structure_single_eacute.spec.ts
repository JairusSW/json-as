// RFC8259 / JSONTestSuite: n_structure_single_eacute.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_single_eacute", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("\ufffd");
  }).toThrow();
});
