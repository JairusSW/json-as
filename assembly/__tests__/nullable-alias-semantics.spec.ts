import { JSON } from "..";
import { describe, expect } from "as-test";
type MaybeText = string | null;


@json class AliasOwner {
  value: MaybeText = "seed";
}
describe("nullable aliases retain effective nullability", () => {
  expect(JSON.parse<AliasOwner>('{"value":null}').value == null).toBe(true);
  const out = new AliasOwner();
  JSON.parse<AliasOwner>('{"value":null}', out);
  expect(out.value == null).toBe(true);
  expect(JSON.parse<AliasOwner>("{}").value).toBe("seed");
});
