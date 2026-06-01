// RFC8259 / JSONTestSuite: n_array_unclosed_with_new_lines.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_unclosed_with_new_lines", () => {
  expect((): void => {
    JSON.parse<f64[]>("[1,\u000a1\u000a,1");
  }).toThrow();
});
