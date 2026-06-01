// RFC8259 / JSONTestSuite: n_number_hex_1_digit.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_hex_1_digit", () => {
  expect((): void => {
    JSON.parse<f64[]>("[0x1]");
  }).toThrow();
});
