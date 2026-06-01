// RFC8259 / JSONTestSuite: n_array_incomplete.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_incomplete", () => {
  expect((): void => {
    JSON.parse<string[]>('["x"');
  }).toThrow();
});
