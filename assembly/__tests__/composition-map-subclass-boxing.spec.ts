import { JSON } from "..";
import { describe, expect } from "as-test";

class PlainMap extends Map<string, JSON.Value> {
  constructor() {
    super();
  }
}
describe("supported map subclasses box like their bases", () => {
  const value = new PlainMap();
  value.set("a", JSON.Value.from<i32>(1));
  expect(JSON.stringify(value)).toBe('{"a":1}');
  expect(JSON.stringify(JSON.Value.from(value))).toBe('{"a":1}');
  const obj = new JSON.Obj();
  obj.set("value", value);
  expect(JSON.stringify(obj)).toBe('{"value":{"a":1}}');
  const arr = new JSON.Arr();
  arr.push(value);
  expect(JSON.stringify(arr)).toBe('[{"a":1}]');
});
