// RFC8259 / JSONTestSuite: n_string_leading_uescaped_thinspace.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_string_leading_uescaped_thinspace", () => {
  expect((): void => {
    JSON.parse<string[]>('[\\u0020"asd"]');
  }).toThrow();
});
