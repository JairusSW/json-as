// RFC8259 / JSONTestSuite: n_array_newlines_unclosed.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_array_newlines_unclosed", () => {
  expect((): void => {
    JSON.parse<string[]>('["a",\u000a4\u000a,1,');
  }).toThrow();
});
