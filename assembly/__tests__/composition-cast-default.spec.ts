import { JSON } from "..";
import { describe, expect } from "as-test";


@json class CastDefault {
  value: i32 = <i8>257;
}
describe("default shortcut respects casts", () => {
  expect(new CastDefault().value).toBe(1);
  expect(JSON.parse<CastDefault>('{"value":257}').value).toBe(257);
  expect(JSON.parse<CastDefault>('{"value":258}').value).toBe(258);
  const out = new CastDefault();
  expect(JSON.parse<CastDefault>('{"value":257}', out).value).toBe(257);
});
