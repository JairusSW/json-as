// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";

@json class Generic<T> {

  @optional value!: T;
}
class Items extends Array<i32> {
  tag: i32 = 7;
}
class Bytes extends Uint8Array {
  requested: i32;
  constructor(n: i32) {
    super(n);
    this.requested = n;
  }
}

@json class ByteOwner {
  value: Bytes = new Bytes(0);
}
let setters: i32 = 0;
class Values extends Array<JSON.Value> {

  @operator("[]=") assign(index: i32, value: JSON.Value): void {
    setters++;
    changetype<Array<JSON.Value>>(this)[index] = JSON.Value.from<i32>(99);
  }
}

@json class Child {
  n: i32 = 7;
}
class Added extends Set<i32> {
  add(value: i32): this {
    super.add(value + 1);
    return this;
  }
}
class Keys<V> extends Map<string, V> {
  keys(): string[] {
    return [];
  }
}
class Words extends Set<string> {
  values(): string[] {
    return ["replacement"];
  }
}
class Numbers extends Set<i32> {
  values(): i32[] {
    return [99];
  }
}
class LookupMap extends Map<string, Child> {
  keys(): string[] {
    return [];
  }
  has(key: string): bool {
    return false;
  }
  get(key: string): Child {
    const value = new Child();
    value.n = 99;
    return value;
  }
  stored(key: string): Child {
    return super.get(key);
  }
}
export function run(kind: i32, reuse: bool): string {
  if (kind == 17 || kind == 18) {
    const out =
      kind == 17
        ? JSON.parse<ByteOwner>('{"value":[10, 20]}').value
        : JSON.parse<Bytes[]>("[[10,20]]")[0];
    return (
      out.requested.toString() +
      ":" +
      out.length.toString() +
      ":" +
      out.join(",")
    );
  }
  if (kind == 19 || kind == 20) {
    const map = new LookupMap();
    const child = new Child();
    map.set("a", child);
    if (kind == 20) {
      const out = JSON.parse<LookupMap>('{"a":{"n":8}}', map);
      assert(out.stored("a") === child);
      return JSON.stringify(out);
    }
    return JSON.stringify(map);
  }
  if (kind == 0) {
    const out = JSON.parse<Generic<Date>>("{}").value;
    return (
      out.getTime().toString() +
      ":" +
      out.getUTCFullYear().toString() +
      ":" +
      out.getUTCMonth().toString() +
      ":" +
      out.getUTCDate().toString()
    );
  }
  if (kind == 1) {
    const out = JSON.parse<Generic<Uint8Array>>("{}").value;
    return (
      out.length.toString() +
      ":" +
      (changetype<usize>(out.buffer) != 0).toString()
    );
  }
  if (kind == 2) return JSON.parse<Generic<Items>>("{}").value.tag.toString();
  if (kind == 3 || kind == 4) {
    const source = kind == 3 ? "[10,20]" : "[10, 20]";
    const out = JSON.parse<Bytes>(
      source,
      reuse ? new Bytes(2) : changetype<Bytes>(0),
    );
    return (
      out.requested.toString() +
      ":" +
      out.length.toString() +
      ":" +
      out.join(",")
    );
  }
  if (kind >= 5 && kind <= 8) {
    const source: JSON.Value[] = [
      JSON.Value.from<i32>(1),
      JSON.Value.from<i32>(2),
    ];
    let out: Values;
    if (kind == 5) out = JSON.Value.from(source).get<Values>();
    else if (kind == 6) {
      const object = new JSON.Obj();
      object.set("a", source);
      out = object.getAs<Values>("a");
    } else if (kind == 7) {
      const array = new JSON.Arr();
      array.length = 1;
      array.set(0, source);
      out = array.getAs<Values>(0);
    } else out = JSON.Value.from(source).as<Values>();
    return JSON.stringify(out) + ":" + setters.toString();
  }
  if (kind == 9 || kind == 11) {
    const map = new Map<string | null, i32>();
    map.set(null, 7);
    return JSON.stringify(map);
  }
  if (kind == 10) {
    const map = new Map<string | null, Child>();
    map.set(null, new Child());
    return JSON.stringify(map);
  }
  if (kind == 12) return JSON.stringify(JSON.parse<Added>("[1,2]"));
  if (kind == 13) {
    const map = new Keys<i32>();
    map.set("a", 7);
    return JSON.stringify(map);
  }
  if (kind == 14) {
    const map = new Keys<Child>();
    map.set("a", new Child());
    return JSON.stringify(map);
  }
  if (kind == 15) {
    const set = new Words();
    set.add("stored");
    return JSON.stringify(set);
  }
  const set = new Numbers();
  set.add(7);
  return JSON.stringify(set);
}
