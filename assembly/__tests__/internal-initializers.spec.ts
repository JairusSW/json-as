import { JSON } from "..";
import { describe, expect } from "as-test";


@json class InternalState {

  @omit factor: i32 = 10;
  private hidden: i32 = 13;
  protected policy: i32 = 17;
  value: i32 = 0;
  read(): i32 {
    return this.hidden + this.policy;
  }
}
describe("internal fields keep declared defaults", () => {
  const value = JSON.parse<InternalState>('{"value":2}');
  expect(value.factor).toBe(10);
  expect(value.read()).toBe(30);
  expect(value.value).toBe(2);
  const out = new InternalState();
  JSON.parse<InternalState>('{"value":2}', out);
  expect(out.factor).toBe(10);
  expect(out.read()).toBe(30);
});
let initializations: i32 = 0;
function defaultPolicy(): i32 {
  initializations++;
  return 19;
}


@json class WireBase {
  value: i32 = 0;
}


@json class DerivedInternal extends WireBase {

  @omit policy: i32 = defaultPolicy();
}


@json class EmptyInternal {
  private policy: i32 = defaultPolicy();
  read(): i32 {
    return this.policy;
  }
}
describe("inherited and empty schemas initialize internal state once", () => {
  initializations = 0;
  const value = JSON.parse<DerivedInternal>('{"value":2}');
  expect(value.policy).toBe(19);
  expect(value.value).toBe(2);
  expect(initializations).toBe(1);
  initializations = 0;
  const rows = JSON.parse<DerivedInternal[]>('[{"value":2}]');
  expect(rows[0].policy).toBe(19);
  expect(rows[0].value).toBe(2);
  expect(initializations).toBe(1);
  initializations = 0;
  const empty = JSON.parse<EmptyInternal>("{}");
  expect(empty.read()).toBe(19);
  expect(initializations).toBe(1);
});


@json class NestedInternal {
  child: DerivedInternal = new DerivedInternal();
}
describe("nested internal defaults are independent of layout", () => {
  initializations = 0;
  const value = JSON.parse<NestedInternal>('{"child":{"value":2}}');
  expect(value.child.policy).toBe(19);
  expect(value.child.value).toBe(2);
  const compactInitializations = initializations;
  initializations = 0;
  const spaced = JSON.parse<NestedInternal>('{ "child": { "value":2 } }');
  expect(spaced.child.policy).toBe(19);
  expect(spaced.child.value).toBe(2);
  expect(initializations).toBe(compactInitializations);
});
