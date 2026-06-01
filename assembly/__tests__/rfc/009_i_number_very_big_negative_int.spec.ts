// RFC8259 / JSONTestSuite: i_number_very_big_negative_int.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_number_very_big_negative_int", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-237462374673276894279832749832423479823246327846]");
  }).not.toThrow();
});
