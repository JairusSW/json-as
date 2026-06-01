// RFC8259 / JSONTestSuite: n_incomplete_null.json  (typed as JSON.Value[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_incomplete_null", () => {
  expect((): void => {
    JSON.parse<JSON.Value[]>("[nul]");
  }).toThrow();
});
