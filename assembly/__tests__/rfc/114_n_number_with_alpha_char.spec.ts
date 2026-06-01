// RFC8259 / JSONTestSuite: n_number_with_alpha_char.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_with_alpha_char", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1.8011670033376514H-308]");
  }).toThrow();
});
