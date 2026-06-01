// RFC8259 / JSONTestSuite: n_array_just_comma.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_just_comma", () => {
  expect((): void => {
    JSON.parse<f64[]>("[,]");
  }).toThrow();
});
