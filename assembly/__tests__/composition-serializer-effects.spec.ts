import { JSON } from "..";
import { describe, expect } from "as-test";
let target: JSON.Obj | null = null;


@json class PureBase {
  value: i32 = 1;
}


@json class EffectfulChild extends PureBase {

  @serializer encode(_self: EffectfulChild): string {
    target!.delete("b");
    return "1";
  }
}
class ManualChild extends PureBase {
  __SERIALIZE(_ptr: usize): void {
    target!.delete("b");
    JSON.__serialize<i32>(1);
  }
}
function mutate(_self: PredicateChild): bool {
  target!.delete("b");
  return false;
}


@json class PredicateChild {

  @omitif(mutate) value: i32 = 1;
}
function parent<T>(value: T): JSON.Obj {
  const out = new JSON.Obj();
  out.set<T>("a", value);
  out.set<i32>("b", 2);
  out.set<i32>("c", 3);
  target = out;
  return out;
}
describe("serializer purity preserves callback mutation policies", () => {
  const pure = new PureBase();
  JSON.Value.from<PureBase>(pure);
  const derived: PureBase = new EffectfulChild();
  expect(JSON.stringify(parent<PureBase>(derived))).toBe('{"a":1,"c":3}');
  const manual: PureBase = new ManualChild();
  expect(JSON.stringify(parent<PureBase>(manual))).toBe('{"a":1,"c":3}');
  expect(JSON.stringify(parent<PredicateChild>(new PredicateChild()))).toBe(
    '{"a":{"value":1},"c":3}',
  );
});
