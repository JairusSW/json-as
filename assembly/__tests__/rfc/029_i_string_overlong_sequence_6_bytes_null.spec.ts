// RFC8259 / JSONTestSuite: i_string_overlong_sequence_6_bytes_null.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_overlong_sequence_6_bytes_null", () => {
  expect((): void => {
    JSON.parse<string[]>('["\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd"]');
  }).not.toThrow();
});
