// RFC8259 / JSONTestSuite: n_incomplete_false.json  (typed as bool[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_incomplete_false", () => {
  expect((): void => {
    JSON.parse<bool[]>("[fals]");
  }).toThrow();
});
