import { JSON } from "..";
import { describe, expect } from "as-test";
describe("boxed numeric conversion decodes stored tags", () => {
  expect(JSON.Box.fromValue<f64>(JSON.Value.from<f32>(1.5))!.value == 1.5).toBe(
    true,
  );
  expect(JSON.Box.fromValue<f64>(JSON.Value.from<i32>(42))!.value == 42.0).toBe(
    true,
  );
  expect(JSON.Box.fromValue<f32>(JSON.Value.from<f64>(1.5))!.value).toBe(
    <f32>1.5,
  );
  expect(
    JSON.Box.fromValue<i64>(JSON.Value.from<i64>(9007199254740993))!.value,
  ).toBe(<i64>9007199254740993);
});
