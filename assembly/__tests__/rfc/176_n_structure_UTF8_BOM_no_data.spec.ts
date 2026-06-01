// RFC8259 / JSONTestSuite: n_structure_UTF8_BOM_no_data.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_UTF8_BOM_no_data", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("\ufeff");
  }).toThrow();
});
