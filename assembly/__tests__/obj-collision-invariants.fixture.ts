// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import {
  setup,
  setupWrapped,
  wrappedRegression as wrappedSemantics,
  reorder,
  lookup,
  build,
  mutate,
  verifyMutation,
  currentObject,
  regression as semantics,
} from "./obj-collision.fixture";

// Inspect storage only in tests, without adding runtime counters or hooks.
// Height/balance and ordering checks establish logarithmic lookup depth even
// when timing is noisy. Bound recursion explicitly so cycles fail promptly.
function compare(a: string, b: string): i32 {
  if (a.length != b.length) return a.length < b.length ? -1 : 1;
  return memory.compare(
    changetype<usize>(a),
    changetype<usize>(b),
    (<usize>a.length) << 1,
  );
}

let visited = new Set<i32>();
function checkNode(
  index: StaticArray<i32>,
  node: i32,
  keys: string[],
  lower: i32,
  upper: i32,
  depth: i32,
): i32 {
  if (node == 0) return 0;
  assert(depth < 32 && node > 0 && node << 2 <= index.length);
  assert(!visited.has(node));
  visited.add(node);
  const base = (node - 1) << 2;
  const entry = index[base];
  assert(entry >= 0 && entry < keys.length);
  if (lower >= 0) assert(compare(keys[lower], keys[entry]) < 0);
  if (upper >= 0) assert(compare(keys[entry], keys[upper]) < 0);
  const left = checkNode(index, index[base + 1], keys, lower, entry, depth + 1);
  const right = checkNode(
    index,
    index[base + 2],
    keys,
    entry,
    upper,
    depth + 1,
  );
  assert(abs(left - right) <= 1);
  assert(index[base + 3] == 1 + max(left, right));
  return index[base + 3];
}

function checkTree(object: JSON.Obj, expected: i32): void {
  const ptr = changetype<usize>(object);
  assert(load<i32>(ptr + offsetof<JSON.Obj>("_indexMask")) < 0);
  const index = load<StaticArray<i32>>(ptr + offsetof<JSON.Obj>("_index"));
  const root = -load<i32>(ptr + offsetof<JSON.Obj>("_indexMask"));
  visited = new Set<i32>();
  checkNode(index, root, object.keys(), -1, -1, 0);
  assert(visited.size == expected);
}

export function regression(n: i32, adversarial: bool): void {
  semantics(n, adversarial);
  if (!adversarial) return;
  if (n == 64) {
    setup(n, true);
    build();
    assert(
      load<i32>(
        changetype<usize>(currentObject()) + offsetof<JSON.Obj>("_indexMask"),
      ) >= 0,
    );
  }
  if (n < 65) return;
  setup(n, true);
  build();
  checkTree(currentObject(), n);
  for (let order = 1; order <= 2; order++) {
    reorder(order);
    build();
    assert(lookup(1) == (n * (n + 1)) / 2);
    checkTree(currentObject(), n);
  }
  mutate();
  verifyMutation();
  checkTree(currentObject(), n * 2);
  const object = currentObject();
  const key = object.keys()[0];
  const start = changetype<usize>(key);
  object.appendRaw<i32>(start, start + ((<usize>key.length) << 1), 12345);
  assert(object.getAs<i32>(key) == 12345);
  checkTree(object, n * 2);
  assert(object.delete(key));
  assert(!object.has(key));
  checkTree(object, n * 2 - 1);
}

export function wrappedRegression(n: i32): void {
  wrappedSemantics(n);
  setupWrapped(n);
  build();
  if (n >= 65) checkTree(currentObject(), n);
  else
    assert(
      load<i32>(
        changetype<usize>(currentObject()) + offsetof<JSON.Obj>("_indexMask"),
      ) >= 0,
    );
  mutate();
  verifyMutation();
  checkTree(currentObject(), n * 2);
}
