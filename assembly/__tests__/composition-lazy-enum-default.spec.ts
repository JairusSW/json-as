import { JSON } from "..";
import { describe, expect } from "as-test";

enum LazyState {
  Off,
  On,
}


@json class LazyEnumDefault {
  value!: JSON.Lazy<LazyState>;
}
describe("lazy enums keep implicit scalar defaults", () => {
  const value = new LazyEnumDefault();
  expect(value.value).toBe(LazyState.Off);
  expect(JSON.stringify(value)).toBe('{"value":0}');
  expect(JSON.stringify(JSON.parse<LazyEnumDefault>("{}"))).toBe('{"value":0}');
});
