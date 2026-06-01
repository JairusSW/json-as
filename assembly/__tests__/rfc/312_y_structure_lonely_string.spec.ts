// RFC8259 / JSONTestSuite: y_structure_lonely_string.json  (typed as string)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_structure_lonely_string", () => {
  expect((): void => {
    JSON.parse<string>('"asd"');
  }).not.toThrow();
});
