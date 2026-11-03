import { JSON } from "..";
import { describe, expect } from "as-test";
import { Token as Renamed } from "./renamed-codec.fixture";


@json class NewlineAliasRecord {

  @alias("line\nname") value: i32 = 0;
}
describe("alias line terminators", () => {
  expect(JSON.parse<NewlineAliasRecord>('{"line\\nname":7}').value).toBe(7);
});


@json class RenamedRecord {
  token: Renamed = new Renamed();
}
describe("renamed codec import", () => {
  expect(JSON.parse<RenamedRecord>('{"token":"updated"}').token.text).toBe(
    "updated",
  );
});
type Name = string;


@json class NullableAliasRecord {
  field: Name | null = null;
}
describe("nullable alias", () => {
  expect(JSON.stringify(JSON.parse<NullableAliasRecord>("{}"))).toBe(
    '{"field":null}',
  );
});


@json class GenericBase<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}


@json class StringChild extends GenericBase<string> {
  flag: bool = true;
  constructor() {
    super("ok");
  }
}
describe("specialized generic inheritance", () => {
  expect(JSON.stringify(new StringChild())).toBe('{"value":"ok","flag":true}');
  expect(
    JSON.parse<StringChild>('{"value":"updated","flag":false}').value,
  ).toBe("updated");
});


@json class GenericDefaults<T> {
  values: T[] = new Array<T>();
  label: string = "T";
}


@json class MoreDefaults extends GenericDefaults<string> {}
describe("generic substitution preserves initializer and string tokens", () => {
  expect(JSON.stringify(new MoreDefaults())).toBe('{"values":[],"label":"T"}');
  expect(JSON.stringify(JSON.parse<MoreDefaults>("{}"))).toBe(
    '{"values":[],"label":"T"}',
  );
});

type MaybeName = string | null;
type WrappedName = MaybeName;


@json class NullableAliasChain {
  field: WrappedName | null = null;
}
describe("nullable aliases preserve one nullable suffix through chains", () => {
  expect(JSON.stringify(JSON.parse<NullableAliasChain>("{}"))).toBe(
    '{"field":null}',
  );
});


@json class UnicodeAlias {

  @alias("line\u2028name\u2029tail") value: i32 = 0;
}
describe("alias Unicode line terminators remain data", () => {
  expect(JSON.parse<UnicodeAlias>('{"line\u2028name\u2029tail":7}').value).toBe(
    7,
  );
});
