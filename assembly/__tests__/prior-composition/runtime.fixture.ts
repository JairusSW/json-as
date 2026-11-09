// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";

@json class RawOwner {
  value: JSON.Raw = JSON.Raw.from("0");
  tail: i32 = 0;
}

@json class ValueOwner {
  value: JSON.Value = JSON.Value.from<i32>(-9);
  tail: i32 = 0;
}

@json class NullableRaw {
  value: JSON.Raw | null = null;
  tail: i32 = 0;
}

@json class Maps {
  a!: Map<string, JSON.Raw>;
  b!: Map<string, JSON.Raw>;
}
let calls: i32 = 0;
function next(): i32 {
  return ++calls;
}

@json class Row {

  @optional first: i32 = next();
  second: i32 = 0;
}
class Operands {

  @operator("+") static add(_a: Operands, _b: Operands): i32 {
    return ++calls;
  }

  @operator("[]") get(_index: i32): i32 {
    return ++calls;
  }
}
const left = new Operands(),
  right = new Operands();

@json class SumRow {
  first: i32 = left + right;
  second: i32 = 0;
}

@json class IndexRow {
  first: i32 = left[0];
  second: i32 = 0;
}

@json class Omission {

  @omitif('JSON.stringify<string>("x").length == 0') value: i32 = 7;
  tail: i32 = 9;
}

@json class Generic<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

@json class Concrete {
  value: usize = 0;
}

@json class CustomValues extends Array<JSON.Value> {
  constructor() {
    super();
  }

  @deserializer("array") decode(_source: string): CustomValues {
    calls++;
    const out = new CustomValues();
    out.push(JSON.Value.from<i32>(99));
    return out;
  }

  @serializer("array") encode(_self: CustomValues): string {
    return "[99]";
  }
}
export function run(kind: i32, reuse: bool): string {
  calls = 0;
  if (kind < 10) {
    const token =
      kind % 5 == 0
        ? "[1,2]"
        : kind % 5 == 1
          ? '"hello"'
          : kind % 5 == 2
            ? "7"
            : kind % 5 == 3
              ? "true"
              : '{"n":1}';
    const source = '{"tail":9,"value":' + token + "}";
    if (kind < 5)
      return JSON.stringify(
        JSON.parse<RawOwner>(
          source,
          reuse ? new RawOwner() : changetype<RawOwner>(0),
        ),
      );
    return JSON.stringify(
      JSON.parse<ValueOwner>(
        source,
        reuse ? new ValueOwner() : changetype<ValueOwner>(0),
      ),
    );
  }
  if (kind == 10) {
    const values: Array<JSON.Value | null> = [null, JSON.Value.from<i32>(2)];
    return JSON.stringify(JSON.Arr.from(values));
  }
  if (kind == 11) {
    const values: Array<JSON.Value | null> = [null, JSON.Value.from<i32>(2)];
    return JSON.stringify(JSON.Value.from(values));
  }
  if (kind == 12) {
    const out = new Maps();
    out.a = new Map<string, JSON.Raw>();
    out.b = new Map<string, JSON.Raw>();
    const raw = JSON.Raw.from("0");
    out.a.set("x", raw);
    out.b.set("x", raw);
    JSON.parse<Maps>('{"a":{"x":1},"b":{"x":2}}', out);
    return JSON.stringify(out);
  }
  if (kind == 13) {
    const out = JSON.parse<Map<string, Row>>(
      '{"x":{"second":7}}',
      reuse ? new Map<string, Row>() : changetype<Map<string, Row>>(0),
    );
    return out.get("x").first.toString() + ":" + calls.toString();
  }
  if (kind == 14) {
    const out = JSON.parse<SumRow[]>('[{"second":7}]');
    return out[0].first.toString() + ":" + calls.toString();
  }
  if (kind == 15) {
    const out = JSON.parse<IndexRow[]>('[{"second":7}]');
    return out[0].first.toString() + ":" + calls.toString();
  }
  if (kind == 16) {
    const out = new NullableRaw();
    out.value = JSON.Raw.from("0");
    JSON.parse<NullableRaw>('{"value":null,"tail":9}', out);
    return (out.value === null).toString();
  }
  if (kind == 17) return JSON.stringify(new Omission());
  if (kind == 18) return JSON.stringify(new Generic<usize>(0));
  if (kind == 19) return JSON.stringify(new Concrete());
  if (kind == 20) {
    const out = JSON.parse<CustomValues[]>("[[7]]");
    return out[0][0].get<i32>().toString() + ":" + calls.toString();
  }
  const value = new CustomValues();
  return (
    JSON.Value.empty().getType(value) == JSON.Value.from(value).type
  ).toString();
}
