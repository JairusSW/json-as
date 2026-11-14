// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
let calls: i32 = 0;
function initial(): i32 {
  calls++;
  return 1;
}


@json class Row {
  first: i32 = initial();
  second: i32 = 0;
}


@json class ConstRow {
  first: i32 = 1;
  second: i32 = 0;
}
let constructions: i32 = 0;
class Strings extends Array<string> {
  constructor() {
    super();
    constructions++;
  }
}


@json class Field {
  value: Strings = new Strings();
}


@json class Generic<T> {
  value!: T;
}


@json class Base {
  __value_lz: u64 = 5;
}


@json class Child extends Base {
  value: JSON.Lazy<i32> = 7;
}
type Num<T = i32> = T;


@json class Alias {
  value: Num = 0;
}


@json class CustomArray extends Array<JSON.Value> {

  @serializer encode(self: CustomArray): string {
    return '"custom"';
  }
}
// The erased base type prevents a statically folded subtype test.
// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
function identity(value: Object): bool {
  return value instanceof Strings;
}
export function run(kind: i32): string {
  if (kind == 0) {
    const map = new Map<string, Row>();
    const row = new Row();
    row.first = 99;
    map.set("x", row);
    calls = 0;
    JSON.parse<Map<string, Row>>('{"x":{"second":7}}', map);
    return map.get("x").first.toString() + ":" + calls.toString();
  }
  if (kind == 1) {
    const map = new Map<string, ConstRow>();
    const row = new ConstRow();
    row.first = 99;
    map.set("x", row);
    JSON.parse<Map<string, ConstRow>>('{"x":{"second":7}}', map);
    return map.get("x").first.toString();
  }
  if (kind == 2) return JSON.stringify(JSON.parse<Alias>('{"value":7}'));
  if (kind == 3) return JSON.stringify(new Child());
  if (kind == 4) {
    constructions = 0;
    const out = JSON.parse<Strings[]>('[["x"]]');
    return identity(out[0]).toString() + ":" + constructions.toString();
  }
  if (kind == 5) {
    constructions = 0;
    const out = JSON.parse<Map<string, Strings>>('{"x":["x"]}');
    return identity(out.get("x")).toString() + ":" + constructions.toString();
  }
  if (kind == 6) {
    constructions = 0;
    const out = JSON.parse<StaticArray<Strings>>('[["x"]]');
    return identity(out[0]).toString() + ":" + constructions.toString();
  }
  if (kind == 7)
    return identity(JSON.parse<Field>('{"value":["x"]}').value).toString();
  if (kind == 8)
    return identity(
      JSON.parse<Generic<Strings>>('{"value":["x"]}').value,
    ).toString();
  const original = new CustomArray();
  original.push(JSON.Value.from<i32>(7));
  const boxed = JSON.Value.from(original);
  const out = boxed.get<CustomArray>();
  assert(changetype<usize>(out) == changetype<usize>(original));
  return JSON.stringify(out);
}
