import { JSON } from "..";
import { describe, expect } from "as-test";


@json class NumberField {
  value: number = 0;
}


@json class FloatControl {
  value: f64 = 0;
}


@json class PointerFields {
  signed: isize = 0;
  unsigned: usize = 0;
}
describe("scalar type spellings agree", () => {
  expect(JSON.parse<number>("1.5")).toBe(1.5);
  expect(JSON.parse<FloatControl>('{"value":1.5}').value).toBe(1.5);
  expect(JSON.parse<NumberField>('{"value":1.5}').value).toBe(1.5);
  const pointers = JSON.parse<PointerFields>('{"signed":7,"unsigned":7}');
  expect(pointers.signed).toBe(<isize>7);
  expect(pointers.unsigned).toBe(<usize>7);
});
