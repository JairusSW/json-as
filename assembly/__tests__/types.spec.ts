import { JSON } from "..";
import { describe, expect } from "./lib";

type StringAlias = string;
type StringAlias1 = StringAlias;
type StringAlias2 = StringAlias1;
type StringAlias3 = StringAlias2;
type StringAlias4 = StringAlias3;


@json
class Alias {
  public foo: StringAlias4 = "";
  constructor(foo: StringAlias2) {
    this.foo = foo;
  }
}

const alias = new Alias("bar");

describe("Should serialize with type aliases", () => {
  expect(JSON.stringify(alias)).toBe('{"foo":"bar"}');
});

describe("Should deserialize with type aliases", () => {
  expect(JSON.stringify(JSON.parse<Alias>('{"foo":"bar"}'))).toBe('{"foo":"bar"}');
});
