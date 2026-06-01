// RFC8259 / JSONTestSuite: i_string_overlong_sequence_2_bytes.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_overlong_sequence_2_bytes", () => {
  expect((): void => {
    JSON.parse<string[]>('["\ufffd\ufffd"]');
  }).not.toThrow();
});
