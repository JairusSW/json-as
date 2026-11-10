// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";

let object = new JSON.Obj();
let keys = new Array<string>();
let missing = "";
let count: i32 = 0;
let output = "";
let hashTarget: u32 = 0;

// FNV-1a's multiplier is invertible modulo 2^32. Solve the last UTF-16
// unit so every key has the selected low 16 hash bits, including the length
// mix. This targets every index capacity used here, without a timed search.
function collisionKey(i: i32): string {
  const prefix = ("00000000" + i.toString()).slice(-8);
  let h: u32 = 2166136261;
  for (let j = 0; j < prefix.length; j++) {
    h ^= prefix.charCodeAt(j);
    h *= 16777619;
  }
  return (
    prefix +
    String.fromCharCode(
      (h ^ (((hashTarget * 899433627) ^ 9) * 899433627)) & 65535,
    )
  );
}

function append(target: JSON.Obj, key: string, value: i32): void {
  const start = changetype<usize>(key);
  target.appendRaw<i32>(start, start + ((<usize>key.length) << 1), value);
}

export function setup(n: i32, adversarial: bool): void {
  count = n;
  keys = new Array<string>(n * 2 + 1);
  for (let i = 0; i < keys.length; i++)
    keys[i] = adversarial ? collisionKey(i) : "ordinary-key-" + i.toString();
  missing = keys[n * 2];
  object = new JSON.Obj();
  for (let i = 0; i < n; i++) append(object, keys[i], i + 1);
}

export function build(): i32 {
  assert(object.has(keys[count - 1]));
  return object.size;
}

export function lookup(rounds: i32): i32 {
  let sum = 0;
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < count; i++) sum += object.getAs<i32>(keys[i]);
    assert(!object.has(missing));
  }
  return sum;
}

export function mutate(): i32 {
  for (let i = 0; i < count; i++) {
    object.set<i32>(keys[i], i + 2);
    object.set<i32>(keys[count + i], i + 1);
  }
  return object.size;
}

export function regression(n: i32, adversarial: bool): void {
  setup(n, adversarial);
  build();
  assert(lookup(1) == (n * (n + 1)) / 2);
  assert(object.get(missing) === null);
  assert(object.getAs<i32>(missing) == 0);
  const first = keys[0];
  append(object, first, 7001);
  assert(object.size == n + 1);
  assert(object.getAs<i32>(first) == 7001);
  object.set<i32>(first, 7002);
  assert(object.values()[0].get<i32>() == 1);
  assert(object.values()[n].get<i32>() == 7002);
  const ordered = object.keys();
  for (let i = 0; i < n; i++) assert(ordered[i] == keys[i]);
  assert(ordered[n] == first);
  for (let i = n; i < n * 2; i++) append(object, keys[i], i + 1);
  for (let i = 1; i < n * 2; i++) assert(object.getAs<i32>(keys[i]) == i + 1);
  assert(object.delete(first));
  assert(!object.delete(first));
  assert(object.size == n * 2 - 1);
  object.set<i32>(first, 8001);
  assert(object.getAs<i32>(first) == 8001);
  assert(object.keys()[object.size - 1] == first);
  object.clear();
  assert(object.size == 0 && !object.has(first));
  object.set<i32>(first, 42);
  assert(object.getAs<i32>(first) == 42);

  // Reuse an indexed destination, retaining duplicate order and decoding
  // escaped equivalents. Prefix and length differences must remain distinct.
  setup(n, adversarial);
  build();
  let source = "{";
  for (let i = 0; i < n; i++) {
    if (i) source += ",";
    source += JSON.stringify(keys[i]) + ":" + (i + 1).toString();
  }
  const expected = source + ',"a":1,"a":2,"":3,"ab":4,"abc":5,"child":{"v":8}}';
  source += ',"a":1,"\\u0061":2,"":3,"ab":4,"abc":5,"child":{"v":7}}';
  const original = object;
  object = JSON.parse<JSON.Obj>(source, object);
  assert(object === original);
  assert(object.size == n + 6);
  assert(object.getAs<i32>("a") == 2);
  assert(object.getAs<i32>("") == 3);
  assert(object.getAs<i32>("ab") == 4);
  assert(object.getAs<i32>("abc") == 5);
  assert(!object.has("abcd"));
  for (let i = 0; i < n; i++) assert(object.getAs<i32>(keys[i]) == i + 1);
  object.getAs<JSON.Obj>("child").set<i32>("v", 8);
  __collect();
  assert(object.getAs<JSON.Obj>("child").getAs<i32>("v") == 8);
  output = JSON.stringify(object);
  assert(output == expected);
  JSON.parse<JSON.Obj>('{"fresh":9}', object);
  __collect();
  assert(object.size == 1 && !object.has(first));
  assert(object.getAs<i32>("fresh") == 9);
}

export function currentObject(): JSON.Obj {
  return object;
}

// Exercise both rotation directions and mixed insertion order independently.
export function reorder(order: i32): void {
  object = new JSON.Obj();
  for (let i = 0; i < count; i++) {
    const at = order == 1 ? count - i - 1 : (i * 53) % count;
    append(object, keys[at], at + 1);
  }
}

export function verifyMutation(): void {
  for (let i = 0; i < count; i++) {
    assert(object.getAs<i32>(keys[i]) == i + 2);
    assert(object.getAs<i32>(keys[count + i]) == i + 1);
  }
}

// Same collision corpus near the end of the table forces probe wraparound.
export function setupWrapped(n: i32): void {
  hashTarget = 65520;
  setup(n, true);
  hashTarget = 0;
}

export function wrappedRegression(n: i32): void {
  hashTarget = 65520;
  regression(n, true);
  hashTarget = 0;
}
