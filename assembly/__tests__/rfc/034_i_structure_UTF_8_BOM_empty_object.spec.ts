// RFC8259 / JSONTestSuite: i_structure_UTF-8_BOM_empty_object.json  (typed as OAll)
import { JSON } from "../..";
import { describe, expect, xdescribe } from "as-test";


@json
class OAll {
  a: string = "";
  n: f64 = 0;
  b: bool = false;
  arr: f64[] = [];
  obj: OAll | null = null;
}

xdescribe("i_structure_UTF-8_BOM_empty_object", () => {
  expect((): void => {
    JSON.parse<OAll>("\ufeff{}");
  }).not.toThrow();
});
