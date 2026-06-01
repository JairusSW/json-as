// RFC8259 / JSONTestSuite: n_array_items_separated_by_semicolon.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_items_separated_by_semicolon", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1:2]");
  }).toThrow();
});
