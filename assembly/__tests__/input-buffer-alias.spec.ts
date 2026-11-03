import { JSON } from "..";
import { describe, expect } from "as-test";


@json class InputAlias {
  a: string = "";
  b: i32 = 0;
}
describe("parsing cannot reuse its own input as decoded field storage", () => {
  const text = "x".repeat(1000);
  const input = '{"a":"' + text + '","b":7}';
  const out = new InputAlias();
  out.a = input;
  JSON.parse<InputAlias>(input, out);
  expect(out.a).toBe(text);
  expect(out.b).toBe(7);
  expect(input).toBe('{"a":"' + text + '","b":7}');
  expect(JSON.parse<InputAlias>(input).a).toBe(text);
});
