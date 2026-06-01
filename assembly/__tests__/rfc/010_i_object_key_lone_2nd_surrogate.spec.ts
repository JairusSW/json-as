// RFC8259 / JSONTestSuite: i_object_key_lone_2nd_surrogate.json  (typed as Map<string, f64>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_object_key_lone_2nd_surrogate", () => {
  expect((): void => {
    JSON.parse<Map<string, f64>>('{"\\uDFAA":0}');
  }).not.toThrow();
});
