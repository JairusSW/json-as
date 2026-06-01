// RFC8259 / JSONTestSuite: y_string_in_array_with_leading_space.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_in_array_with_leading_space", () => {
  expect((): void => {
    JSON.parse<string[]>('[ "asd"]');
  }).not.toThrow();
});
