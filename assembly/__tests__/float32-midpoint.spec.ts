import { JSON } from "..";
import { describe, expect } from "as-test";


@json class FloatField {
  value: f32 = 0;
}
describe("decimal input above an f32 midpoint rounds upward", () => {
  expect(reinterpret<u32>(JSON.parse<f32>("1.0000000596046448"))).toBe(
    0x3f800001,
  );
  expect(
    reinterpret<u32>(
      JSON.parse<FloatField>('{"value":1.0000000596046448}').value,
    ),
  ).toBe(0x3f800001);
  expect(reinterpret<u32>(JSON.parse<f32[]>("[1.0000000596046448]")[0])).toBe(
    0x3f800001,
  );
});
