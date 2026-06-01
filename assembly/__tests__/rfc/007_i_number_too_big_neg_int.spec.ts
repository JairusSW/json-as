// RFC8259 / JSONTestSuite: i_number_too_big_neg_int.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_number_too_big_neg_int", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-123123123123123123123123123123]");
  }).not.toThrow();
});
