// RFC8259 / JSONTestSuite: n_incomplete_true.json  (typed as bool[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_incomplete_true", () => {
  expect((): void => {
    JSON.parse<bool[]>("[tru]");
  }).toThrow();
});
