import { JSON } from "..";
import { describe, expect } from "as-test";


@json class TypeBase {
  n: i32 = 0;
}


@json class TypeChild extends TypeBase {
  extra: i32 = 1;
}
describe("getType classifies represented values", () => {
  const query = JSON.Value.empty();
  const integer = JSON.Value.from<i32>(42);
  expect(query.getType(integer)).toBe(integer.type);
  const base: TypeBase = new TypeChild();
  expect(query.getType<TypeBase>(base)).toBe(
    JSON.Value.from<TypeBase>(base).type,
  );
});
