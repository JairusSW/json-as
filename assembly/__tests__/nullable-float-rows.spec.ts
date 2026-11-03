import { JSON } from "..";
import { describe, expect } from "as-test";


@json class FloatRows {
  rows: (f64[] | null)[] = [];
}
describe("nullable float rows preserve nulls and reuse", () => {
  const source = '{"rows":[null,[1.5],null,[]]}';
  const out = new FloatRows();
  expect(JSON.stringify(JSON.parse<FloatRows>(source))).toBe(source);
  JSON.parse<FloatRows>(source, out);
  expect(JSON.stringify(out)).toBe(source);
  JSON.parse<FloatRows>('{"rows":[[2.5],null,[]]}', out);
  expect(JSON.stringify(out)).toBe('{"rows":[[2.5],null,[]]}');
});
