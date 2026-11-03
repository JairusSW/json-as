import { JSON } from "..";
import { describe, expect } from "as-test";
type MaybeText = string | null;


@json class AliasOmission {

  @omitnull value: MaybeText = null;
}
describe("nullable aliases support omission", () => {
  expect(JSON.stringify(new AliasOmission())).toBe("{}");
  expect(JSON.stringify(JSON.parse<AliasOmission>('{"value":"x"}'))).toBe(
    '{"value":"x"}',
  );
});
