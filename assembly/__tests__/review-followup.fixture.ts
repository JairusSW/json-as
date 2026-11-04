import { JSON } from "..";
import * as model from "./composition-enum.fixture";
import { State as Reexported } from "./review-enum-barrel.fixture";
let target: JSON.Obj | null = null;

@json class EmptyManual {
  __SERIALIZE(_ptr: usize): void {
    target!.delete("b");
    JSON.__serialize<i32>(1);
  }
}
let calls: i32 = 0;
class Defaults {
  static get next(): i32 {
    return ++calls;
  }
}

@json class GetterOwner {
  first: i32 = Defaults.next;
  second: i32 = 0;
}

@json class Child {
  value: i32 = 0;
  constructor() {
    this.value = ++calls;
  }
}

@json class ConstructorOwner {
  child: Child = new Child();
  second: i32 = 0;
}

@json class NamespaceOwner {
  value: model.State = model.State.Off;
}

@json class BarrelOwner {
  value: Reexported = Reexported.Off;
}

@json class GeneratedRaw extends JSON.Raw {
  n: i32 = 0;
  constructor() {
    super("0");
  }
}
export function allocInput(bytes: i32): string {
  return changetype<string>(__new(bytes, idof<string>()));
}
export function manual(): string {
  const out = new JSON.Obj();
  out.set("a", new EmptyManual());
  out.set<i32>("b", 2);
  out.set<i32>("c", 3);
  target = out;
  return JSON.stringify(out);
}
export function getter(array: bool): i32 {
  calls = 0;
  const value = array
    ? JSON.parse<GetterOwner[]>('[{"second":7}]')[0]
    : JSON.parse<GetterOwner>('{"second":7}');
  assert(calls == value.first);
  return value.first;
}
export function constructorDefault(array: bool): i32 {
  calls = 0;
  const value = array
    ? JSON.parse<ConstructorOwner[]>('[{"second":7}]')[0]
    : JSON.parse<ConstructorOwner>('{"second":7}');
  assert(calls == value.child.value);
  return value.child.value;
}
export function enumField(barrel: bool): i32 {
  return barrel
    ? JSON.parse<BarrelOwner>('{"value":1}').value
    : JSON.parse<NamespaceOwner>('{"value":1}').value;
}
export function rawSubtype(reuse: bool): bool {
  const value = JSON.parse<GeneratedRaw>(
    '{"n":7}',
    reuse ? new GeneratedRaw() : changetype<GeneratedRaw>(0),
  );
  if (load<u32>(changetype<usize>(value) - 8) != idof<GeneratedRaw>())
    return false;
  return value.n == 7;
}
export function pointerTag(signed: bool): i32 {
  const query = JSON.Value.empty();
  return signed ? query.getType<isize>(-7) : query.getType<usize>(7);
}
export function boxedPointerTag(signed: bool): i32 {
  return signed
    ? JSON.Value.from<isize>(-7).type
    : JSON.Value.from<usize>(7).type;
}
export function scalarArraySource(): i32 {
  const parent = JSON.parse<JSON.Obj>(
    '{"unrelated":"' + "x".repeat(10000) + '","values":[1,2,3]}',
  );
  const values = parent.get("values")!.get<JSON.Arr>();
  parent.clear();
  assert(values.getAs<f64>(0) == 1);
  assert(values.getAs<f64>(1) == 2);
  assert(values.getAs<f64>(2) == 3);
  return values._src.length;
}
export function lazySourceControl(): bool {
  const value = JSON.parse<JSON.Arr>('[1,"hello",{"n":7}]');
  if (value._src.length == 0) return false;
  if (value.getAs<string>(1) != "hello") return false;
  if (value.getAs<JSON.Obj>(2).get("n")!.get<f64>() != 7) return false;
  return JSON.stringify(value) == '[1,"hello",{"n":7}]';
}
export function zeroPointerTag(): i32 {
  return JSON.Value.empty().getType<usize>(0);
}
