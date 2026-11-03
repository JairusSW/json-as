import { JSON } from "..";
import { describe, expect } from "as-test";


@json class LazyBase {
  value: JSON.Lazy<i32> = 1;
}


@json class EagerChild extends LazyBase {
  value: i32 = 2;
}


@json class EagerBase {
  value: i32 = 1;
}


@json class LazyChild extends EagerBase {
  value: JSON.Lazy<i32> = 2;
}
describe("logical overrides may mix eager and lazy declarations", () => {
  expect(JSON.stringify(new EagerChild())).toBe('{"value":2}');
  expect(JSON.stringify(new LazyChild())).toBe('{"value":2}');
});
