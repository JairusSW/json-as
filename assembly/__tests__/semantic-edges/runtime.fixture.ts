import { JSON } from "../..";
type Item = i32;
type Identity<Item> = Item;

@json class AliasRow {
  value: Identity<f32> = 1.5;
}
namespace M {
  type Item = f32;
  type Value = Item;

  @json export class Row {
    value: Value = 1.5;
  }
}
class Stamp extends Date {
  constructor(time: i64 = 0) {
    super(time);
  }
}
class Raw extends JSON.Raw {
  constructor(data: string = "null") {
    super(data);
  }
}

@json class Lazy<T> {
  value!: JSON.Lazy<T>;
}

@json class ConcreteDate {
  value!: JSON.Lazy<Stamp>;
}

@json class ConcreteRaw {
  value!: JSON.Lazy<Raw>;
}
// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
function stamp(value: Object): bool {
  return value instanceof Stamp;
}
// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
function raw(value: Object): bool {
  return value instanceof Raw;
}
let calls: i32 = 0;
class Operand {

  @operator.prefix("-") static negate(_value: Operand): i32 {
    return ++calls;
  }

  @operator.prefix("+") static positive(_value: Operand): i32 {
    return ++calls;
  }

  @operator.prefix("~") static invert(_value: Operand): i32 {
    return ++calls;
  }

  @operator.prefix("!") static not(_value: Operand): bool {
    calls++;
    return true;
  }
}
function next(): i32 {
  return ++calls;
}
const operand = new Operand();

@json class Row {
  first: i32 = -operand;
  second: i32 = 0;
}

@json class Nested {
  value: Row | null = null;
}

@json class PlusRow {
  first: i32 = +operand;
  second: i32 = 0;
}

@json class TildeRow {
  first: i32 = ~operand;
  second: i32 = 0;
}

@json class NotRow {
  first: bool = !operand;
  second: i32 = 0;
}

@json class CallRow {
  first: i32 = next();
  second: i32 = 0;
}

@json class Envelope<T> {
  value: T | null = null;
}
function sample<T>(route: i32): T {
  if (route == 0) return JSON.parse<T>('{"second":7}');
  if (route == 1) return JSON.parse<T[]>('[{"second":7}]')[0];
  if (route == 2)
    return JSON.parse<Map<string, T>>('{"x":{"second":7}}').get("x");
  return JSON.parse<Envelope<T>>('{"value":{"second":7}}').value!;
}
function observe<T>(route: i32): string {
  calls = 0;
  const out = sample<T>(route);
  return out.first.toString() + ":" + calls.toString();
}
let pushCalls: i32 = 0;
function finish<T>(value: T): string {
  assert(pushCalls == 0);
  return JSON.stringify(value);
}
class Strings extends Array<string> {
  push(value: string): i32 {
    pushCalls++;
    return super.push(value + "!");
  }
}
class Floats extends Array<f64> {
  push(value: f64): i32 {
    pushCalls++;
    return super.push(value + 1);
  }
}
class Booleans extends Array<bool> {
  push(value: bool): i32 {
    pushCalls++;
    return super.push(!value);
  }
}
class Numbers extends Array<i32> {
  push(value: i32): i32 {
    pushCalls++;
    return super.push(value + 1);
  }
}

@json class NumbersField {
  value: Numbers = new Numbers();
}
export function run(kind: i32): string {
  if (kind == 0) {
    assert(new AliasRow().value == 1.5);
    return JSON.stringify(new AliasRow());
  }
  if (kind == 1) {
    assert(new M.Row().value == 1.5);
    return JSON.stringify(new M.Row());
  }
  if (kind == 2) return stamp(new Lazy<Stamp>().value).toString();
  if (kind == 3) return stamp(JSON.parse<Lazy<Stamp>>("{}").value).toString();
  if (kind == 4) return stamp(JSON.parse<ConcreteDate>("{}").value).toString();
  if (kind == 5) return raw(new Lazy<Raw>().value).toString();
  if (kind == 6) return raw(JSON.parse<Lazy<Raw>>("{}").value).toString();
  if (kind == 7) return raw(JSON.parse<ConcreteRaw>("{}").value).toString();
  calls = 0;
  if (kind == 8) {
    const out = JSON.parse<Row>('{"second":7}');
    return out.first.toString() + ":" + calls.toString();
  }
  if (kind == 9) {
    const out = JSON.parse<Row[]>('[{"second":7}]');
    return out[0].first.toString() + ":" + calls.toString();
  }
  if (kind == 10) {
    const out = JSON.parse<Map<string, Row>>('{"x":{"second":7}}');
    return out.get("x").first.toString() + ":" + calls.toString();
  }
  if (kind == 11) {
    const out = JSON.parse<Nested>('{"value":{"second":7}}');
    return out.value!.first.toString() + ":" + calls.toString();
  }
  if (kind == 12) return finish(JSON.parse<Numbers>("[1,2]"));
  if (kind == 13) return finish(JSON.parse<Numbers>("[1,2]", new Numbers()));
  if (kind == 14) return finish(JSON.parse<Numbers[]>("[[1,2]]"));
  if (kind == 15) return finish(JSON.parse<NumbersField>('{"value":[1,2]}'));
  if (kind == 16) {
    const original = new Numbers();
    original.push(1);
    original.push(2);
    pushCalls = 0;
    return finish(JSON.parse<Numbers>(JSON.stringify(original)));
  }
  if (kind < 21) return observe<PlusRow>(kind - 17);
  if (kind < 25) return observe<TildeRow>(kind - 21);
  if (kind < 29) return observe<NotRow>(kind - 25);
  if (kind < 33) return observe<CallRow>(kind - 29);
  if (kind == 33) return finish(JSON.parse<Strings>('["x","y"]'));
  if (kind == 34) return finish(JSON.parse<Floats>("[1.5,2.5]"));
  return finish(JSON.parse<Booleans>("[true,false]"));
}
