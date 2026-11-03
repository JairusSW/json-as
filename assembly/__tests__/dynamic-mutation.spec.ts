import { JSON } from "..";
import { describe, expect } from "as-test";
let object = new JSON.Obj();
let array = new JSON.Arr();
let growth = 1;


@json class DeleteProperty {

  @serializer serialize(): string {
    object.delete("b");
    return "1";
  }
}


@json class ReplaceElement {

  @serializer serialize(): string {
    for (let i = 0; i < growth; i++) array.push<i32>(3);
    array.set<i32>(1, 9);
    return "1";
  }
}


@json class ShrinkJoin {

  @serializer serialize(): string {
    array.length = 1;
    return "7";
  }
}
describe("callbacks observe live container identities", () => {
  object = new JSON.Obj();
  object.set("a", new DeleteProperty());
  object.set<i32>("b", 2);
  object.set<i32>("c", 3);
  expect(JSON.stringify(object)).toBe('{"a":1,"c":3}');
  for (let g = 1; g <= 7; g += 6) {
    growth = g;
    array = new JSON.Arr();
    array.push(new ReplaceElement());
    array.push<i32>(2);
    expect(JSON.stringify(array)).toBe("[1,9]");
  }
});
describe("join tolerates receiver shrinking", () => {
  array = new JSON.Arr();
  array.push(new ShrinkJoin());
  array.push<i32>(2);
  array.push<i32>(3);
  expect(array.join(",")).toBe("7,,");
});

describe("callback traversal retains duplicate occurrences and untouched slices", () => {
  object = JSON.parse<JSON.Obj>(
    '{"a":0,"dup":1,"dup":2,"b":2,"keep":[1.0, 2.0]}',
  );
  object.set("a", new DeleteProperty());
  expect(JSON.stringify(object)).toBe(
    '{"a":1,"dup":1,"dup":2,"keep":[1.0, 2.0]}',
  );
});

describe("callback detection follows eager nested containers", () => {
  for (let kind = 0; kind < 2; kind++) {
    object = new JSON.Obj();
    if (kind == 0) {
      const child = new JSON.Obj();
      child.set("nested", new DeleteProperty());
      object.set("a", child);
    } else {
      const child = new JSON.Arr();
      child.push(new DeleteProperty());
      object.set("a", child);
    }
    object.set<i32>("b", 2);
    object.set<i32>("c", 3);
    expect(JSON.stringify(object)).toBe(
      kind == 0 ? '{"a":{"nested":1},"c":3}' : '{"a":[1],"c":3}',
    );
  }
});
