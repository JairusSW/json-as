// RFC8259 / JSONTestSuite: n_object_lone_continuation_byte_in_key_and_trailing_comma.json  (typed as OAll)
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

describe("n_object_lone_continuation_byte_in_key_and_trailing_comma", () => {
  expect((): void => {
    JSON.parse<OAll>('{"\ufffd":"0",}');
  }).toThrow();
});
