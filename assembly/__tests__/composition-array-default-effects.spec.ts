import { JSON } from "..";
import { describe, expect } from "as-test";

let calls: i32 = 0;
function nextDefault(): i32 {
  return ++calls;
}


@json class OptionalDefault {

  @optional first: i32 = nextDefault();
  second: i32 = 0;
}
describe("array defaults execute once when returned", () => {
  calls = 0;
  const direct = JSON.parse<OptionalDefault>('{"second":7}');
  expect(direct.first).toBe(1);
  expect(calls).toBe(1);
  calls = 0;
  const rows = JSON.parse<OptionalDefault[]>('[{"second":7}]');
  expect(rows[0].first).toBe(1);
  expect(calls).toBe(1);
});


@json class RequiredDefault {
  first: i32 = nextDefault();
  second: i32 = 0;
}
describe("implicit missing defaults agree at root and in arrays", () => {
  calls = 0;
  const direct = JSON.parse<RequiredDefault>('{"second":7}');
  const rootCalls = calls;
  expect(direct.first).toBe(1);
  calls = 0;
  const rows = JSON.parse<RequiredDefault[]>('[{"second":7}]');
  expect(rows[0].first).toBe(direct.first);
  expect(calls).toBe(rootCalls);
});


@json class PrefixDefault {
  first: i32 = ++calls;
  second: i32 = 0;
}


@json class FieldDefaults {
  rows: RequiredDefault[] = [];
}
describe("state-changing defaults remain stable in nested destinations", () => {
  calls = 0;
  const rows = JSON.parse<PrefixDefault[]>('[{"second":7}]');
  expect(rows[0].first).toBe(1);
  expect(calls).toBe(1);
  calls = 0;
  const holder = JSON.parse<FieldDefaults>('{"rows":[{"second":7}]}');
  expect(holder.rows[0].first).toBe(1);
  expect(calls).toBe(1);
});
