// RFC8259 / JSONTestSuite: n_array_star_inside.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_star_inside", () => {
  expect((): void => {
    JSON.parse<f64[]>("[*]");
  }).toThrow();
});
