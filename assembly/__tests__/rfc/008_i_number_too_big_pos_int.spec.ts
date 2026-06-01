// RFC8259 / JSONTestSuite: i_number_too_big_pos_int.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_number_too_big_pos_int", () => {
  expect((): void => {
    JSON.parse<f64[]>("[100000000000000000000]");
  }).not.toThrow();
});
