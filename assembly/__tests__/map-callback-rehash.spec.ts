import { JSON } from "..";
import { describe, expect } from "as-test";

let entries = new Map<string, RehashValue>();

@json
class RehashValue {
  value: i32 = 0;
  constructor(value: i32 = 0) {
    this.value = value;
  }

  @serializer("any")
  serialize(self: RehashValue): string {
    if (self.value == 1) entries.set("extra", new RehashValue(4));
    return self.value.toString();
  }
}
describe("map serialization retains original members across callback rehash", () => {
  entries.set("deleted", new RehashValue(0));
  entries.set("a", new RehashValue(1));
  entries.set("b", new RehashValue(2));
  entries.set("c", new RehashValue(3));
  entries.delete("deleted");
  const result = JSON.stringify(entries);
  expect(entries.has("b")).toBe(true);
  expect(result.includes('"b":2')).toBe(true);
});
