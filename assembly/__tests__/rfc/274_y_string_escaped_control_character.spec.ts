// RFC8259 / JSONTestSuite: y_string_escaped_control_character.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_escaped_control_character", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\u0012"]');
  }).not.toThrow();
});
