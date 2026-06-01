// RFC8259 / JSONTestSuite: n_string_single_doublequote.json  (typed as string)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_single_doublequote", () => {
  expect((): void => {
    JSON.parse<string>('"');
  }).toThrow();
});
