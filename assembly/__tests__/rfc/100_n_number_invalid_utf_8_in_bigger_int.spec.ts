// RFC8259 / JSONTestSuite: n_number_invalid-utf-8-in-bigger-int.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_invalid-utf-8-in-bigger-int", () => {
  expect((): void => {
    JSON.parse<f64[]>("[123\ufffd]");
  }).toThrow();
});
