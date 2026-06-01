// RFC8259 / JSONTestSuite: n_structure_lone-invalid-utf-8.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_lone-invalid-utf-8", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("\ufffd");
  }).toThrow();
});
