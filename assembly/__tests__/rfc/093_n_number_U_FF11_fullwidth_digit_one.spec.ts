// RFC8259 / JSONTestSuite: n_number_U+FF11_fullwidth_digit_one.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_U+FF11_fullwidth_digit_one", () => {
  expect((): void => {
    JSON.parse<f64[]>("[\uff11]");
  }).toThrow();
});
