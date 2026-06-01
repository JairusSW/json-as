// RFC8259 / JSONTestSuite: i_string_overlong_sequence_6_bytes.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_overlong_sequence_6_bytes", () => {
  expect((): void => {
    JSON.parse<string[]>('["\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd"]');
  }).not.toThrow();
});
