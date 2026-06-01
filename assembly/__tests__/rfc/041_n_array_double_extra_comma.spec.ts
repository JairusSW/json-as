// RFC8259 / JSONTestSuite: n_array_double_extra_comma.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_double_extra_comma", () => {
  expect((): void => {
    JSON.parse<string[]>('["x",,]');
  }).toThrow();
});
