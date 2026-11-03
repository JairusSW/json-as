import { JSON } from "..";
import { describe, expect } from "as-test";


@json class Lazy<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}


@json class OrdinaryLazyName {
  inner: Lazy<i32> = new Lazy<i32>(7);
}
describe("unrelated Lazy classes remain ordinary objects", () => {
  expect(JSON.stringify(new OrdinaryLazyName())).toBe('{"inner":{"value":7}}');
});
