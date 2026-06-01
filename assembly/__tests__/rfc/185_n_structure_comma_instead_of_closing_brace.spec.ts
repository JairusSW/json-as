// RFC8259 / JSONTestSuite: n_structure_comma_instead_of_closing_brace.json  (typed as OAll)
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

describe("n_structure_comma_instead_of_closing_brace", () => {
  expect((): void => {
    JSON.parse<OAll>('{"x": true,');
  }).toThrow();
});
