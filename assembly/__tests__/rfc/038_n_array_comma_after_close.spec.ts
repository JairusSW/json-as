// RFC8259 / JSONTestSuite: n_array_comma_after_close.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_comma_after_close", () => {
  expect((): void => {
    JSON.parse<string[]>('[""],');
  }).toThrow();
});
