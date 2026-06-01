// RFC8259 / JSONTestSuite: y_array_empty-string.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_array_empty-string", () => {
  expect((): void => {
    JSON.parse<string[]>('[""]');
  }).not.toThrow();
});
