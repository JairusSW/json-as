// RFC8259 / JSONTestSuite: n_structure_angle_bracket_..json  (typed as JSON.Value)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_angle_bracket_.", () => {
  expect((): void => {
    JSON.parse<JSON.Value>("<.>");
  }).toThrow();
});
