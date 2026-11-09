// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class ConstructorChild {
  value: i32 = 0;
  constructor() {
    this.value = 7;
  }
}


@json class ConstructorParent {
  child: ConstructorChild = new ConstructorChild();
}


@json class SharedChild {
  n: i32 = 0;
}


@json class SharedHolder {
  a: SharedChild = new SharedChild();
  b: SharedChild = new SharedChild();
}


@json class SharedArrays {
  a: i32[] = [];
  b: i32[] = [];
  rows: i32[][] = [];
  floats: f64[][] = [];
  planes: i32[][][] = [];
}


@json class SharedMaps {
  a: Map<string, i32> = new Map();
  b: Map<string, i32> = new Map();
}


@json class TraceHolder {
  value: string = "";
}


@json class OverrideBase {
  field: i32 = 1;
}


@json class OverrideChild extends OverrideBase {
  field: i32 = 2;
}


@json class OmittedChild extends OverrideBase {

  @omit field: i32 = 3;
}


@json class NullableGeneric<T> {
  value!: T | null;
}


@json class CombinedOmit {

  @omitnull @omitif((self: CombinedOmit) => true) field: string | null =
    "present";
  value: i32 = 7;
}
namespace Scoped {
  export enum State {
    Off,
    On,
  }


  @json export class Record {
    state: State = State.Off;
  }
}


@json class i32Box {
  value: i32 = 1;
}


@json class PrefixHolder {
  tag: i32 = 0;
  box: i32Box = new i32Box();
}
describe("default shortcut preserves constructor semantics", () => {
  expect(
    JSON.parse<ConstructorParent>('{"child":{"value":0}}').child.value,
  ).toBe(0);
  expect(
    JSON.parse<ConstructorParent>('{"child": {"value":0}}').child.value,
  ).toBe(0);
});
describe("composite destinations do not alias", () => {
  const out = new SharedHolder();
  out.b = out.a;
  JSON.parse<SharedHolder>('{"a":{"n":1},"b":{"n":2}}', out);
  expect(out.a.n).toBe(1);
  expect(out.b.n).toBe(2);
  const lists = new SharedArrays();
  lists.b = lists.a;
  const row: i32[] = [0];
  lists.rows = [row, row];
  const floats: f64[] = [0];
  lists.floats = [floats, floats];
  const plane: i32[][] = [[0]];
  lists.planes = [plane, plane];
  JSON.parse<SharedArrays>(
    '{"a":[1],"b":[2],"rows":[[1],[2]],"floats":[[1],[2]],"planes":[[[1]],[[2]]]}',
    lists,
  );
  expect(JSON.stringify(lists)).toBe(
    '{"a":[1],"b":[2],"rows":[[1],[2]],"floats":[[1],[2]],"planes":[[[1]],[[2]]]}',
  );
  const maps = new SharedMaps();
  maps.b = maps.a;
  JSON.parse<SharedMaps>('{"a":{"x":1},"b":{"x":2}}', maps);
  expect(maps.a.get("x")).toBe(1);
  expect(maps.b.get("x")).toBe(2);
});
describe("stringify reuse invalidates parser traces", () => {
  const source = '{"value":"' + "x".repeat(100) + '"}';
  const out = new TraceHolder();
  for (let i = 0; i < 6; i++) {
    JSON.parse<TraceHolder>(source, out);
    JSON.parse<TraceHolder>(source, out);
    if (i == 0) out.value = JSON.stringify<bool>(true, out.value);
    else if (i == 1) out.value = JSON.stringify<i32>(12345, out.value);
    else if (i == 2) out.value = JSON.stringify<f64>(1.5, out.value);
    else if (i == 3) out.value = JSON.stringify<usize>(0, out.value);
    else if (i == 4) out.value = JSON.stringify<Date>(new Date(0), out.value);
    else out.value = JSON.stringify<string>("abc", out.value);
    JSON.parse<TraceHolder>(source, out);
    expect(out.value).toBe("x".repeat(100));
  }
});
describe("inherited and nullable property metadata", () => {
  expect(JSON.stringify(new OverrideChild())).toBe('{"field":2}');
  expect(JSON.stringify(new OmittedChild())).toBe("{}");
  expect(JSON.stringify(JSON.parse<NullableGeneric<string>>("{}"))).toBe(
    '{"value":null}',
  );
  expect(JSON.stringify(new CombinedOmit())).toBe('{"value":7}');
});
describe("type classification is independent of spelling", () => {
  expect(JSON.parse<Scoped.Record>('{"state":1}').state).toBe(Scoped.State.On);
  expect(
    JSON.parse<PrefixHolder>('{"box":{"value":9},"tag":2}').box.value,
  ).toBe(9);
});
describe("large cancelling exponents", () => {
  expect(JSON.parse<f64>("1" + "0".repeat(10001) + "e-10001")).toBe(1);
  expect(JSON.parse<f64>("0." + "0".repeat(10000) + "1e10001")).toBe(1);
});
describe("canonical Date years round trip", () => {
  for (let i = 0; i < 3; i++) {
    const text =
      i == 0
        ? "-000001-01-01T00:00:00.000Z"
        : i == 1
          ? "-000001-12-31T23:59:59.999Z"
          : "+010000-01-01T00:00:00.000Z";
    expect(JSON.stringify(JSON.parse<Date>('"' + text + '"'))).toBe(
      '"' + text + '"',
    );
  }
});

class SeededSet extends Set<i32> {
  constructor() {
    super();
    this.add(99);
  }
}

describe("Set reset preserves replacement semantics", () => {
  expect(JSON.stringify(JSON.parse<SeededSet>("[1,2]"))).toBe("[1,2]");
  const values = new Set<i32>();
  for (let i = 0; i < 100; i++) values.add(i);
  values.delete(0);
  values.delete(50);
  const expected: i32[] = [];
  for (let i = 1; i < 100; i++) if (i != 50) expected.push(i);
  expect(JSON.stringify(values)).toBe(JSON.stringify(expected));
  JSON.parse<Set<i32>>("[7,8]", values);
  expect(JSON.stringify(values)).toBe("[7,8]");
  JSON.parse<Set<i32>>("[]", values);
  expect(values.size).toBe(0);
  values.add(11);
  expect(JSON.stringify(values)).toBe("[11]");
});


@json class NumberCodec {
  value: i32 = 0;


  @deserializer("number") decode(source: string): NumberCodec {
    const value = new NumberCodec();
    value.value = JSON.parse<i32>(source);
    return value;
  }
}


@json class GenericCodecPair<T> {
  a: T[] = [];
  b: T[] = [];
}
describe("generic codec array destinations claim shared allocations", () => {
  const value = new GenericCodecPair<NumberCodec>();
  value.b = value.a;
  JSON.parse<GenericCodecPair<NumberCodec>>('{"a":[1],"b":[2]}', value);
  expect(value.a[0].value).toBe(1);
  expect(value.b[0].value).toBe(2);
});
describe("every emptying array operation releases its source anchor", () => {
  for (let method = 0; method < 3; method++) {
    const value = JSON.parse<JSON.Arr>('["large"]');
    if (method == 0) value.pop();
    else if (method == 1) value.shift();
    else value.splice(0);
    expect(value.length).toBe(0);
    expect(value._src.length).toBe(0);
  }
});
