// RFC8259 / JSONTestSuite: n_structure_ascii-unicode-identifier.json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_ascii-unicode-identifier", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("a\u00e5");
  }).toThrow();
});
