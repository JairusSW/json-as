import { JSON } from "..";
import { describe, expect } from "as-test";
import {
  ExternalVector as ImportedVector,
  ExternalMap,
} from "./generic-alias.fixture";


@json class ImportedAliasOwner {
  values: ImportedVector<i32> = [];
  table: ExternalMap<string, i32> = new Map();
}
type Vector<T> = Array<T>;
type NestedVector<T> = Vector<Vector<T>>;


@json class VectorOwner {
  values: Vector<i32> = [];
  flag: bool = false;
}
function shouldOmit(value: NamedPredicate): bool {
  return value.hidden;
}


@json class NamedPredicate {

  @omit hidden: bool = false;


  @omitif(shouldOmit) value: i32 = 7;
}


@json class CustomRaw extends JSON.Raw {
  constructor() {
    super("7");
  }


  @serializer encode(self: CustomRaw): string {
    return "42";
  }
}
describe("generic aliases retain field classification", () => {
  expect(
    JSON.stringify(JSON.parse<VectorOwner>('{"values":[1,2],"flag":true}')),
  ).toBe('{"values":[1,2],"flag":true}');
  expect(
    JSON.stringify(JSON.parse<VectorOwner>('{"flag":true,"values":[1,2]}')),
  ).toBe('{"values":[1,2],"flag":true}');
  expect(JSON.stringify(JSON.parse<NestedVector<i32>>("[[1],[2]]"))).toBe(
    "[[1],[2]]",
  );
});
describe("named omission predicates are invoked", () => {
  const value = new NamedPredicate();
  expect(JSON.stringify(value)).toBe('{"value":7}');
  value.hidden = true;
  expect(JSON.stringify(value)).toBe("{}");
});
describe("custom Raw representations compose", () => {
  const value = new CustomRaw();
  const values = new Map<string, CustomRaw>();
  values.set("x", value);
  expect(JSON.stringify(value)).toBe("42");
  expect(JSON.stringify<CustomRaw[]>([value])).toBe("[42]");
  expect(JSON.stringify(values)).toBe('{"x":42}');
  expect(JSON.stringify(JSON.Value.from(value))).toBe("42");
  const nullable = new Map<string, CustomRaw | null>();
  nullable.set("x", value);
  expect(JSON.stringify(nullable)).toBe('{"x":42}');
  const plain = new Map<string, JSON.Raw>();
  plain.set("x", JSON.Raw.from("7"));
  expect(JSON.stringify(plain)).toBe('{"x":7}');
  const object = new JSON.Obj();
  object.set("x", value);
  expect(JSON.stringify(object)).toBe('{"x":42}');
  const arr = new JSON.Arr();
  arr.push(value);
  expect(JSON.stringify(arr)).toBe("[42]");
});

function allocatePredicate(value: PredicateBuffer): bool {
  JSON.stringify("z".repeat(100000));
  value.value = "updated";
  return false;
}


@json class PredicateBuffer {

  @omitif(allocatePredicate) value: string = "initial";
  tail: i32 = 7;
}
describe("predicate callbacks preserve serialization cursors", () => {
  expect(JSON.stringify(new PredicateBuffer())).toBe(
    '{"value":"updated","tail":7}',
  );
});

describe("renamed generic aliases preserve substitutions", () => {
  const value = JSON.parse<ImportedAliasOwner>(
    '{"values":[1,2],"table":{"n":7}}',
  );
  expect(JSON.stringify(value)).toBe('{"values":[1,2],"table":{"n":7}}');
});
