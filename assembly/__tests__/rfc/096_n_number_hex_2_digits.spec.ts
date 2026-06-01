// RFC8259 / JSONTestSuite: n_number_hex_2_digits.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_hex_2_digits", () => {
  expect((): void => {
    JSON.parse<f64[]>("[0x42]");
  }).toThrow();
});
