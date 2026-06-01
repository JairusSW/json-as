// RFC8259 / JSONTestSuite: y_string_in_array.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_in_array", () => {
  expect((): void => {
    JSON.parse<string[]>('["asd"]');
  }).not.toThrow();
});
