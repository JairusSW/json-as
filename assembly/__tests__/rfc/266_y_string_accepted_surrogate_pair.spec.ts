// RFC8259 / JSONTestSuite: y_string_accepted_surrogate_pair.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_accepted_surrogate_pair", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uD801\\udc37"]');
  }).not.toThrow();
});
