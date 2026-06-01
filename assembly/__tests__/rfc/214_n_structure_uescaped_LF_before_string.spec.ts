// RFC8259 / JSONTestSuite: n_structure_uescaped_LF_before_string.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_uescaped_LF_before_string", () => {
  expect((): void => {
    JSON.parse<f64[]>('[\\u000A""]');
  }).toThrow();
});
