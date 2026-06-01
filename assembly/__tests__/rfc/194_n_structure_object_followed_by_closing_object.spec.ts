// RFC8259 / JSONTestSuite: n_structure_object_followed_by_closing_object.json  (typed as OAll)
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

describe("n_structure_object_followed_by_closing_object", () => {
  expect((): void => {
    JSON.parse<OAll>("{}}");
  }).toThrow();
});
