// RFC8259 / JSONTestSuite: y_structure_string_empty.json  (typed as string)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_structure_string_empty", () => {
  expect((): void => {
    JSON.parse<string>('""');
  }).not.toThrow();
});
