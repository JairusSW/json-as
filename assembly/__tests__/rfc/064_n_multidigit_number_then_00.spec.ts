// RFC8259 / JSONTestSuite: n_multidigit_number_then_00.json  (typed as f64)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_multidigit_number_then_00", () => {
  expect((): void => {
    JSON.parse<f64>("123\u0000");
  }).toThrow();
});
