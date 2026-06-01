// RFC8259 / JSONTestSuite: n_structure_open_open.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_open_open", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\{["\\{["\\{["\\{');
  }).toThrow();
});
