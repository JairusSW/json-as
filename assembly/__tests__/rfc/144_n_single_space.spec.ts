// RFC8259 / JSONTestSuite: n_single_space.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_single_space", () => {
  expect((): void => {
    JSON.parse<JSON.Value>(" ");
  }).toThrow();
});
