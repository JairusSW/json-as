// RFC8259 / JSONTestSuite: n_object_emoji.json  (typed as OAll)
import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class OAll {
  a: string = "";
  n: f64 = 0;
  b: bool = false;
  arr: f64[] = [];
  obj: OAll | null = null;
}

describe("n_object_emoji", () => {
  expect((): void => {
    JSON.parse<OAll>("{\ud83c\udde8\ud83c\udded}");
  }).toThrow();
});
