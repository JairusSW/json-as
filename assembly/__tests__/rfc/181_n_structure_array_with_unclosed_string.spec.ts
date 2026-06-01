// RFC8259 / JSONTestSuite: n_structure_array_with_unclosed_string.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_array_with_unclosed_string", () => {
  expect((): void => {
    JSON.parse<string[]>('["asd]');
  }).toThrow();
});
