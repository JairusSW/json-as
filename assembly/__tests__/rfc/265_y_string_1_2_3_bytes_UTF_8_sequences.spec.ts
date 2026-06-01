// RFC8259 / JSONTestSuite: y_string_1_2_3_bytes_UTF-8_sequences.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_1_2_3_bytes_UTF-8_sequences", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\u0060\\u012a\\u12AB"]');
  }).not.toThrow();
});
