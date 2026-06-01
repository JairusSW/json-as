// RFC8259 / JSONTestSuite: n_array_unclosed.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_unclosed", () => {
  expect((): void => {
    JSON.parse<string[]>('[""');
  }).toThrow();
});
