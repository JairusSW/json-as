// RFC8259 / JSONTestSuite: n_array_colon_instead_of_comma.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_colon_instead_of_comma", () => {
  expect((): void => {
    JSON.parse<string[]>('["": 1]');
  }).toThrow();
});
