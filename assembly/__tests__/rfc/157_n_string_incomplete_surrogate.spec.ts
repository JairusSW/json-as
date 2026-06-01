// RFC8259 / JSONTestSuite: n_string_incomplete_surrogate.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_incomplete_surrogate", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uD834\\uDd"]');
  }).toThrow();
});
