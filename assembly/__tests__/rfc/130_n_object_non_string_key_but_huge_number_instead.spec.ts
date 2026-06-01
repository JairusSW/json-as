// RFC8259 / JSONTestSuite: n_object_non_string_key_but_huge_number_instead.json  (typed as OAll)
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

describe("n_object_non_string_key_but_huge_number_instead", () => {
  expect((): void => {
    JSON.parse<OAll>("{9999E9999:1}");
  }).toThrow();
});
