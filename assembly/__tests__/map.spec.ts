import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should deserialize complex objects", () => {
  const input = '{"a":{"b":{"c":[{"d":"random value 1"},{"e":["value 2","value 3"]}],"f":{"g":{"h":[1,2,3],"i":{"j":"nested value"}}}},"k":"simple value"},"l":[{"m":"another value","n":{"o":"deep nested","p":[{"q":"even deeper"},"final value"]}}],"r":null}';
  expect(JSON.stringify(JSON.parse<Map<string, JSON.Raw>>(input))).toBe(input);
});
