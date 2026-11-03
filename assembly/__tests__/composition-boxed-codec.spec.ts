import { JSON } from "..";
import { describe, expect } from "as-test";


@json class CustomBox extends JSON.Box<i32> {
  constructor() {
    super(7);
  }


  @serializer encode(_self: CustomBox): string {
    return '"seven"';
  }
}
describe("dynamic boxes honor custom wire formats", () => {
  const value = new CustomBox();
  expect(JSON.Value.empty().getType(value)).toBe(JSON.Value.from(value).type);
  expect(JSON.stringify(value)).toBe('"seven"');
  expect(JSON.stringify<CustomBox[]>([value])).toBe('["seven"]');
  expect(JSON.stringify(JSON.Value.from(value))).toBe('"seven"');
  const obj = new JSON.Obj();
  obj.set("value", value);
  expect(JSON.stringify(obj)).toBe('{"value":"seven"}');
  const arr = new JSON.Arr();
  arr.push(value);
  expect(JSON.stringify(arr)).toBe('["seven"]');
  expect(JSON.stringify(JSON.Value.from(JSON.Box.from<i32>(7)))).toBe("7");
});
