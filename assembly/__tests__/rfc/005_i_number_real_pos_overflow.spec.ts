// RFC8259 / JSONTestSuite: i_number_real_pos_overflow.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_number_real_pos_overflow", () => {
  expect((): void => {
    JSON.parse<f64[]>("[123123e100000]");
  }).not.toThrow();
});
