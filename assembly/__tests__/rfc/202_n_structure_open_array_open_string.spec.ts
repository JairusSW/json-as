// RFC8259 / JSONTestSuite: n_structure_open_array_open_string.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_open_array_open_string", () => {
  expect((): void => {
    JSON.parse<string[]>('["a');
  }).toThrow();
});
