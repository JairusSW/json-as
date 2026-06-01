// RFC8259 / JSONTestSuite: n_array_a_invalid_utf8.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_a_invalid_utf8", () => {
  expect((): void => {
    JSON.parse<f64[]>("[a\ufffd]");
  }).toThrow();
});
