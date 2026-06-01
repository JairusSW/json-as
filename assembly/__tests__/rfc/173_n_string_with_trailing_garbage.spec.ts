// RFC8259 / JSONTestSuite: n_string_with_trailing_garbage.json  (typed as string)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_with_trailing_garbage", () => {
  expect((): void => {
    JSON.parse<string>('""x');
  }).toThrow();
});
