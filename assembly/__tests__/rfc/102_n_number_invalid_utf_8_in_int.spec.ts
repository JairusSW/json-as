// RFC8259 / JSONTestSuite: n_number_invalid-utf-8-in-int.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_invalid-utf-8-in-int", () => {
  expect((): void => {
    JSON.parse<f64[]>("[0\ufffd]\u000a");
  }).toThrow();
});
