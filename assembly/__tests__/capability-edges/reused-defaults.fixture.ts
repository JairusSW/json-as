// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";

@json class State {

  @optional value: i32 = 7;

  @optional other: i32 = 8;

  @optional text: string | null = null;

  @optional items: i32[] = [];
}

@json class Generic<T> {

  @optional value: T = <T>7;

  @optional other: i32 = 8;
  payload!: Uint8Array;
}

@json class LazyState {

  @optional text!: JSON.Lazy<string | null>;

  @optional count!: JSON.Lazy<f64>;

  @optional other: i32 = 8;
}

@json class RowParent {
  rows: State[] = [];
}

@json class ConcreteParent {
  child: State | null = null;
}

@json class GenericParent {
  child: Generic<i32> | null = null;
}
function state(p: State): string {
  return (
    p.value.toString() +
    ":" +
    p.other.toString() +
    ":" +
    (p.text === null ? "null" : p.text!)
  );
}
export function run(pretty: bool): string {
  const second = pretty
    ? '{ "other": 2, "items": [4, 5] }'
    : '{"other":2,"items":[4,5]}';
  const out = JSON.parse<State>(
    '{"value":99,"other":88,"text":"old","items":[1,2]}',
  );
  const items = out.items;
  const result = JSON.parse<State>(second, out);
  const fresh = JSON.parse<State>(second);
  const expected = state(fresh);
  // Fast parsing retains present container storage while resetting omissions.
  if (isDefined(result.__DESERIALIZE_FAST)) {
    if (result.__DESERIALIZE_FAST_ENABLED()) assert(result.items === items);
  }
  const concrete = JSON.parse<ConcreteParent>(
    '{"child":{"value":99,"other":88,"text":"old","items":[1,2]}}',
  );
  const child = concrete.child!;
  const innerItems = child.items;
  const concreteInput = pretty
    ? '{ "child": { "other": 2, "items": [4,5] } }'
    : '{"child":{"other":2,"items":[4,5]}}';
  JSON.parse<ConcreteParent>(concreteInput, concrete);
  if (isDefined(concrete.__DESERIALIZE_FAST)) {
    if (concrete.__DESERIALIZE_FAST_ENABLED()) {
      assert(concrete.child === child);
      assert(concrete.child!.items === innerItems);
    }
  }
  const generic = JSON.parse<GenericParent>(
    '{"child":{"value":99,"other":88,"payload":[1,2]}}',
  );
  const genericChild = generic.child;
  const payload = genericChild!.payload;
  JSON.parse<GenericParent>(
    pretty
      ? '{ "child": { "other": 2, "payload": [4,5] } }'
      : '{"child":{"other":2,"payload":[4,5]}}',
    generic,
  );
  if (isDefined(generic.__DESERIALIZE_FAST)) {
    if (generic.__DESERIALIZE_FAST_ENABLED()) {
      assert(generic.child === genericChild);
      assert(generic.child!.payload === payload);
    }
  }
  assert(expected == "7:2:null");
  // Repeat the same source after mutation to exercise cached presence traces.
  out.value = 99;
  out.text = "old";
  concrete.child!.value = 99;
  concrete.child!.text = "old";
  generic.child!.value = 99;
  JSON.parse<State>(second, out);
  JSON.parse<ConcreteParent>(concreteInput, concrete);
  JSON.parse<GenericParent>(
    pretty
      ? '{ "child": { "other": 2, "payload": [4,5] } }'
      : '{"child":{"other":2,"payload":[4,5]}}',
    generic,
  );
  assert(state(out) == expected && state(concrete.child!) == expected);
  assert(generic.child!.value == 7 && generic.child!.other == 2);
  const lazy = JSON.parse<LazyState>('{"text":"old","count":99,"other":88}');
  assert(lazy.text == "old" && lazy.count == 99);
  JSON.parse<LazyState>(pretty ? '{ "other": 2 }' : '{"other":2}', lazy);
  assert(lazy.text === null && lazy.count == 0 && lazy.other == 2);
  const firstRow = '{"value":99,"other":88,"text":"old","items":[1,2]}';
  const array = JSON.parse<State[]>("[" + firstRow + "]");
  const row = array[0];
  const rowItems = row.items;
  JSON.parse<State[]>("[" + second + "]", array);
  const map = JSON.parse<Map<string, State>>('{"x":' + firstRow + "}");
  const mapRow = map.get("x");
  const mapItems = mapRow.items;
  JSON.parse<Map<string, State>>('{"x":' + second + "}", map);
  const holder = JSON.parse<RowParent>('{"rows":[' + firstRow + "]}");
  const heldRow = holder.rows[0];
  const heldItems = heldRow.items;
  JSON.parse<RowParent>('{"rows":[' + second + "]}", holder);
  if (isDefined(row.__DESERIALIZE_FAST)) {
    if (row.__DESERIALIZE_FAST_ENABLED()) {
      assert(array[0] === row && array[0].items === rowItems);
      assert(map.get("x") === mapRow && map.get("x").items === mapItems);
      assert(holder.rows[0] === heldRow && holder.rows[0].items === heldItems);
    }
  }
  return (
    state(result) +
    "|" +
    state(concrete.child!) +
    "|" +
    generic.child!.value.toString() +
    ":" +
    generic.child!.other.toString() +
    "|" +
    state(array[0]) +
    "|" +
    state(map.get("x")) +
    "|" +
    state(holder.rows[0])
  );
}
