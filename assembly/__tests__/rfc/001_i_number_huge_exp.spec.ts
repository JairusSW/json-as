// RFC8259 / JSONTestSuite: i_number_huge_exp.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_number_huge_exp", () => {
  expect((): void => {
    JSON.parse<f64[]>(
      "[0.4e00669999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999969999999006]",
    );
  }).not.toThrow();
});
