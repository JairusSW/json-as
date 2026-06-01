// RFC8259 / JSONTestSuite: n_string_invalid-utf-8-in-escape.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_invalid-utf-8-in-escape", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\u\ufffd"]');
  }).toThrow();
});
