import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class StrictChild {
  id: i32 = 0;
}


@json
class StrictStruct {
  name: string = "";
  child: StrictChild = new StrictChild();
  values: i32[] = [];
  lookup: Map<string, i32> = new Map<string, i32>();
}


@json
class StrictFastBoundsStruct {
  integer: i32 = 0;
  unsigned: u64 = 0;
  float: f64 = 0;
  enabled: bool = false;
}


@json
class StrictUnmarkedMidStruct {
  a: i32 = 0;
  b: i32 = 0;
  c: i32 = 0;
  d: i32 = 0;
  e: i32 = 0;
  f: i32 = 0;
  g: i32 = 0;
  h: i32 = 0;
}


@json
class StrictStringFastBoundsStruct {
  first: string = "";
  second: string = "";
}


@json({ lazy: "all" })
class StrictLazyStruct {
  name: string = "";
  child: JSON.Lazy<StrictChild> = new StrictChild();
  values: JSON.Lazy<i32[]> = [];
  lookup: JSON.Lazy<Map<string, i32>> = new Map<string, i32>();
  dynamic: JSON.Lazy<JSON.Obj> = new JSON.Obj();
}

let strictPublicInput = "";
let strictStringPublicInput = "";

function expectStrictPublicReject(source: string): void {
  strictPublicInput = source;
  expect((): void => {
    JSON.parse<StrictFastBoundsStruct>(strictPublicInput);
  }).toThrow();
}

function expectStrictStringPublicReject(source: string): void {
  strictStringPublicInput = source;
  expect((): void => {
    JSON.parse<StrictStringFastBoundsStruct>(strictStringPublicInput);
  }).toThrow();
}

describe("strict structs reject malformed JSON at the public boundary", () => {
  expectStrictPublicReject('{"integer":1,}');
  expectStrictPublicReject('{,"integer":1}');
  expectStrictPublicReject('{"integer":1,,"unsigned":2}');
  expectStrictPublicReject('{"integer":1 "unsigned":2}');
  expectStrictPublicReject('{"integer" 1}');
  expectStrictPublicReject("{integer:1}");
  expectStrictPublicReject('{"integer":+1}');
  expectStrictPublicReject('{"integer":01}');
  expectStrictPublicReject('{"float":1.}');
  expectStrictPublicReject('{"float":1e}');
  expectStrictPublicReject('{"float":NaN}');
  expectStrictPublicReject('{"enabled":True}');
  expectStrictPublicReject('{"enabled":truex}');
  expectStrictPublicReject('{"inte\\qger":1}');
  expectStrictPublicReject('{"integer":1} trailing');
  expectStrictPublicReject('{"integer":1}}');
});

describe("strict string structs validate at the public boundary", () => {
  const valid = '{"first":"line\\nquote: \\"","second":"slash: \\\\"}';
  const out = JSON.parse<StrictStringFastBoundsStruct>(valid);
  expect(out.first).toBe('line\nquote: "');
  expect(out.second).toBe("slash: \\");

  expectStrictStringPublicReject('{"first":"line\nbreak","second":"ok"}');
  expectStrictStringPublicReject('{"first":"tab\tbreak","second":"ok"}');
  expectStrictStringPublicReject('{"first":"bad\\q","second":"ok"}');
  expectStrictStringPublicReject('{"first":"ok","second":"unterminated}');
});

describe("strict schemas without keyed fallback retain the validated slow path", () => {
  const parsed = JSON.parse<StrictUnmarkedMidStruct>(
    '{"h":8,"g":7,"f":6,"e":5,"d":4,"c":3,"b":2,"a":1}',
  );
  expect(parsed.a).toBe(1);
  expect(parsed.h).toBe(8);
});

describe("strict mode accepts every parse target family", () => {
  const struct = JSON.parse<StrictStruct>(
    '{"name":"typed","child":{"id":7},"values":[1,2],"lookup":{"a":3}}',
  );
  expect(struct.name).toBe("typed");
  expect(struct.child.id).toBe(7);
  expect(struct.values[1]).toBe(2);
  expect(struct.lookup.get("a")).toBe(3);

  const lazy = JSON.parse<StrictLazyStruct>(
    '{"name":"lazy","child":{"id":8},"values":[4,5],"lookup":{"b":6},"dynamic":{"ok":true}}',
  );
  expect(lazy.name).toBe("lazy");
  expect(lazy.child.id).toBe(8);
  expect(lazy.values[1]).toBe(5);
  expect(lazy.lookup.get("b")).toBe(6);
  expect(lazy.dynamic.getAs<bool>("ok")).toBe(true);

  const obj = JSON.parse<JSON.Obj>('{"n":1,"nested":{"ok":true}}');
  expect(obj.getAs<f64>("n")).toBe(1.0);
  expect(obj.getAs<JSON.Obj>("nested").getAs<bool>("ok")).toBe(true);

  const arr = JSON.parse<JSON.Arr>('[1,{"ok":true}]');
  expect(arr.at(0).get<f64>()).toBe(1.0);
  expect(arr.at(1).get<JSON.Obj>().getAs<bool>("ok")).toBe(true);

  const value = JSON.parse<JSON.Value>('{"items":[1,2]}');
  expect(value.get<JSON.Obj>().getAs<JSON.Arr>("items").at(1).get<f64>()).toBe(
    2.0,
  );
  expect(JSON.parse<JSON.Raw>('{"raw":[1,true]}').toString()).toBe(
    '{"raw":[1,true]}',
  );

  const map = JSON.parse<Map<string, StrictChild>>('{"first":{"id":9}}');
  expect(map.get("first")!.id).toBe(9);
  expect(JSON.parse<i32[]>("[1,2,3]")[2]).toBe(3);
  expect(JSON.parse<StaticArray<i32>>("[4,5]")[1]).toBe(5);
  expect(JSON.parse<Set<i32>>("[6,7]").has(7)).toBe(true);
  expect(JSON.parse<Int32Array>("[8,9]")[1]).toBe(9);
  expect(JSON.parse<ArrayBuffer>("[10,11]").byteLength).toBe(2);
  expect(JSON.parse<Date>('"1970-01-01T00:00:00.000Z"').getTime()).toBe(0);

  expect(JSON.parse<i32>("42")).toBe(42);
  expect(JSON.parse<f64>("1.25")).toBe(1.25);
  expect(JSON.parse<bool>("true")).toBe(true);
  expect(JSON.parse<string>('"text"')).toBe("text");
});

describe("strict mode rejects malformed JSON for every target family", () => {
  expect((): void => {
    JSON.parse<StrictStruct>('{"name":"typed",}');
  }).toThrow();
  expect((): void => {
    JSON.parse<StrictLazyStruct>('{"values":[1,2,]}');
  }).toThrow();
  expect((): void => {
    JSON.parse<JSON.Obj>('{"n":1,}');
  }).toThrow();
  expect((): void => {
    JSON.parse<JSON.Arr>("[1,]");
  }).toThrow();
  expect((): void => {
    JSON.parse<JSON.Value>("01");
  }).toThrow();
  expect((): void => {
    JSON.parse<JSON.Raw>("true false");
  }).toThrow();
  expect((): void => {
    JSON.parse<Map<string, i32>>('{"a":1,}');
  }).toThrow();
  expect((): void => {
    JSON.parse<i32[]>("[1 2]");
  }).toThrow();
  expect((): void => {
    JSON.parse<StaticArray<i32>>("[1,2,]");
  }).toThrow();
  expect((): void => {
    JSON.parse<Set<i32>>("[1;2]");
  }).toThrow();
  expect((): void => {
    JSON.parse<Int32Array>("[1,2,]");
  }).toThrow();
  expect((): void => {
    JSON.parse<ArrayBuffer>("[1,2,]");
  }).toThrow();
  expect((): void => {
    JSON.parse<Date>('"1970-01-01T00:00:00.000Z" trailing');
  }).toThrow();
  expect((): void => {
    JSON.parse<i32>("+1");
  }).toThrow();
  expect((): void => {
    JSON.parse<f64>("NaN");
  }).toThrow();
  expect((): void => {
    JSON.parse<bool>("True");
  }).toThrow();
  expect((): void => {
    JSON.parse<string>('"unterminated');
  }).toThrow();
});
