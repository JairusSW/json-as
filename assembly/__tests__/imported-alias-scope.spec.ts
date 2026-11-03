import { JSON } from "..";
import { describe, expect } from "as-test";
import { PublicAlias, makePublicAlias } from "./private-alias.fixture";


@json class PublicAliasOwner {
  item: PublicAlias = makePublicAlias();
}
describe("imported aliases preserve an emitted binding", () => {
  expect(JSON.parse<PublicAliasOwner>('{"item":{"value":7}}').item.value).toBe(
    7,
  );
});
