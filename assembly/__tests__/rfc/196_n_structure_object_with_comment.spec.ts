// RFC8259 / JSONTestSuite: n_structure_object_with_comment.json  (typed as OAll)
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

describe("n_structure_object_with_comment", () => {
  expect((): void => {
    JSON.parse<OAll>('{"a":/*comment*/"b"}');
  }).toThrow();
});
