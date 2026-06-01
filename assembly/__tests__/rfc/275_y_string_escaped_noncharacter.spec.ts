// RFC8259 / JSONTestSuite: y_string_escaped_noncharacter.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_escaped_noncharacter", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uFFFF"]');
  }).not.toThrow();
});
