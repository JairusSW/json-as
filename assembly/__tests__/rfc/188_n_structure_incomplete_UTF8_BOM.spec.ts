// RFC8259 / JSONTestSuite: n_structure_incomplete_UTF8_BOM.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_incomplete_UTF8_BOM", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("\ufffd{}");
  }).toThrow();
});
