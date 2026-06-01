// RFC8259 / JSONTestSuite: n_number_minus_sign_with_trailing_garbage.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_minus_sign_with_trailing_garbage", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-foo]");
  }).toThrow();
});
