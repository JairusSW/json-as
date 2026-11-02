import { JSON } from "..";
import { describe, expect } from "as-test";
let root: ArrayOwner | null = null;
let churn = new Array<i32[]>();

@json
class CollectingElement {
  value: i32 = 0;
  constructor(value: i32 = 0) {
    this.value = value;
  }

  @serializer("any")
  serialize(self: CollectingElement): string {
    if (self.value == 1) {
      root!.items = [];
      __collect();
      for (let i = 0; i < 128; i++) {
        const scratch = new Array<i32>(8);
        scratch.fill(99);
        churn.push(scratch);
      }
      __collect();
    }
    return self.value.toString();
  }
}

@json
class ArrayOwner {
  items: CollectingElement[] = [];
}
describe("array field remains alive after callback replaces owner field", () => {
  root = new ArrayOwner();
  root!.items.push(new CollectingElement(1));
  root!.items.push(new CollectingElement(2));
  root!.items.push(new CollectingElement(3));
  const result = JSON.stringify(root!);
  expect(result).toBe('{"items":[1,2,3]}');
});
