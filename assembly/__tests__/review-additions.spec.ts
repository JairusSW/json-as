import { JSON } from "..";
import { describe, expect } from "as-test";
let sequence: i32 = 0;
function next(): i32 {
  return ++sequence;
}


@json class ConditionalOrder {
  first: i32 = next();


  @omitif((self:ConditionalOrder)=>false) second: i32 = next();
}
class Bytes extends Uint8Array {
  constructor(n: i32) {
    super(n);
  }
}
class Words extends Uint16Array {
  constructor(n: i32) {
    super(n);
  }
}
class Doubles extends Float64Array {
  constructor(n: i32) {
    super(n);
  }
}


@json class NullableFields {
  values: (JSON.Value | null)[] = [];
  entries: Map<string, JSON.Value | null> = new Map();
}


@json class SeededOwner {
  values: Map<string, i32> = new Seeded();
}
class Seeded extends Map<string, i32> {
  constructor() {
    super();
    this.set("seed", 99);
  }
}
describe("boxed typed subclasses preserve element kinds", () => {
  const bytes = new Bytes(2);
  bytes[0] = 128;
  bytes[1] = 255;
  expect(JSON.stringify(JSON.Value.from(bytes))).toBe(JSON.stringify(bytes));
  const words = new Words(2);
  words[0] = 300;
  words[1] = 400;
  expect(JSON.stringify(JSON.Value.from(words))).toBe(JSON.stringify(words));
  const doubles = new Doubles(2);
  doubles[0] = 1.25;
  doubles[1] = 2.5;
  expect(JSON.stringify(JSON.Value.from(doubles))).toBe(
    JSON.stringify(doubles),
  );
});
describe("omission does not reorder default evaluation", () => {
  sequence = 0;
  const value = JSON.parse<ConditionalOrder>("{}");
  expect(value.first).toBe(1);
  expect(value.second).toBe(2);
});
describe("maps replace constructor entries", () => {
  expect(JSON.stringify(JSON.parse<Seeded>("{}"))).toBe("{}");
  expect(JSON.stringify(JSON.parse<Seeded>('{"new":7}'))).toBe('{"new":7}');
  expect(JSON.stringify(JSON.parse<SeededOwner>('{"values":{}}').values)).toBe(
    "{}",
  );
});
describe("nullable dynamic map values retain reference null", () => {
  const out = new Map<string, JSON.Value | null>();
  expect(
    JSON.parse<Map<string, JSON.Value | null>>('{"x":null}').get("x") == null,
  ).toBe(true);
  JSON.parse<Map<string, JSON.Value | null>>('{"x":null}', out);
  expect(out.get("x") == null).toBe(true);
  expect(JSON.parse<Map<string, JSON.Value>>('{"x":null}').get("x").type).toBe(
    JSON.Types.Null,
  );
});

describe("nullable dynamic array values retain reference null", () => {
  const values = JSON.parse<(JSON.Value | null)[]>("[null,1]");
  expect(values[0] == null).toBe(true);
  expect(values[1]!.get<f64>()).toBe(1);
  const out = new NullableFields();
  JSON.parse<NullableFields>('{"values":[null,1],"entries":{"x":null}}', out);
  expect(out.values[0] == null).toBe(true);
  expect(out.values[1]!.get<f64>()).toBe(1);
  expect(out.entries.get("x") == null).toBe(true);
  const fixed = JSON.parse<StaticArray<JSON.Value | null>>("[null,1]");
  expect(fixed[0] == null).toBe(true);
  expect(fixed[1]!.get<f64>()).toBe(1);
});
