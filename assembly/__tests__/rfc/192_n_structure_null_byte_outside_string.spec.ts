// RFC8259 / JSONTestSuite: n_structure_null-byte-outside-string.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_null-byte-outside-string", () => {
  expect((): void => {
    JSON.parse<f64[]>("[\u0000]");
  }).toThrow();
});
