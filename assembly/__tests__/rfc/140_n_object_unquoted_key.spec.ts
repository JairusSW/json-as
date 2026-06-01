// RFC8259 / JSONTestSuite: n_object_unquoted_key.json  (typed as OAll)
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

describe("n_object_unquoted_key", () => {
  expect((): void => {
    JSON.parse<OAll>('{a: "b"}');
  }).toThrow();
});
