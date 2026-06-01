// RFC8259 / JSONTestSuite: y_string_two-byte-utf-8.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_two-byte-utf-8", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\u0123"]');
  }).not.toThrow();
});
