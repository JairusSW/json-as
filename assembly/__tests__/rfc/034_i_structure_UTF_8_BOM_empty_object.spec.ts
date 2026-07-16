// RFC8259 / JSONTestSuite: i_structure_UTF-8_BOM_empty_object.json  (typed as OAll)
import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class OAll {
  a: string = "";
  n: f64 = 0;
  b: bool = false;
  arr: f64[] = [];
  obj: OAll | null = null;
}

// Implementation-defined case: a leading BOM is not part of the JSON grammar.
describe("i_structure_UTF-8_BOM_empty_object", () => {
  expect((): void => {
    JSON.parse<OAll>("\ufeff{}");
  }).toThrow();
});
