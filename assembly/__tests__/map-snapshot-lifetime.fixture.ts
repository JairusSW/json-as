// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { canSnapshotCallbackKeys } from "../util/runtime";

let objects: Map<SnapshotKey, Payload> | null = null;
let scalars: Map<SnapshotKey, f64> | null = null;
let wide: Map<i64, MutatingValue> | null = null;

function collectInCallback(): void {
  // Minimal collection requires explicit roots; its callbacks are checked
  // without collecting hidden library temporaries from an active call stack.
  if (ASC_RUNTIME == 2) __collect();
}


@json
class Payload {
  n: i32 = 0;
  text: string = "";
}


@json
class SnapshotKey {
  id: i32 = 0;
  constructor(id: i32) {
    this.id = id;
  }


  @serializer("number")
  encode(self: SnapshotKey): string {
    if (self.id == 1 && objects !== null) {
      const map = objects!;
      objects = null;
      map.clear();
      collectInCallback();
      for (let i = 0; i < 256; i++)
        map.set(new SnapshotKey(10000 + i), new Payload());
      collectInCallback();
    }
    if (self.id == 1 && scalars !== null) {
      const map = scalars!;
      scalars = null;
      map.clear();
      collectInCallback();
      for (let i = 0; i < 256; i++) map.set(new SnapshotKey(10000 + i), 9.5);
      collectInCallback();
    }
    return self.id.toString();
  }
}

class HiddenMap extends Map<SnapshotKey, Payload> {
  get size(): i32 {
    return 0;
  }
  keys(): SnapshotKey[] {
    return [];
  }
}


@json
class MutatingValue {
  n: i32 = 0;


  @serializer("number")
  encode(self: MutatingValue): string {
    if (self.n == 1 && wide !== null) {
      const map = wide!;
      wide = null;
      map.clear();
      collectInCallback();
      for (let i = 0; i < 256; i++)
        map.set(((<i64>1) << 50) + i, new MutatingValue());
      collectInCallback();
    }
    return self.n.toString();
  }
}

function objectInput(count: i32): HiddenMap {
  const map = new HiddenMap();
  for (let i = 1; i <= count * 2; i++) {
    const key = new SnapshotKey(i);
    const value = new Payload();
    value.n = i;
    value.text = "v" + i.toString();
    map.set(key, value);
    if (!(i & 1)) map.delete(key);
  }
  return map;
}

export function enabled(): bool {
  return canSnapshotCallbackKeys();
}


@global
export function finalizeSnapshotObject(_ptr: usize): void {}

export function run(kind: i32, count: i32): string {
  if (kind == 0) {
    const map = objectInput(count);
    objects = map;
    return JSON.stringify(map);
  }
  if (kind == 1) {
    const map = new Map<SnapshotKey, f64>();
    for (let i = 1; i <= count * 2; i++) {
      const key = new SnapshotKey(i);
      map.set(key, i == 1 ? 7.25 : 9.5);
      if (!(i & 1)) map.delete(key);
    }
    scalars = map;
    return JSON.stringify(map);
  }
  const map = new Map<i64, MutatingValue>();
  for (let i = 1; i <= count * 2; i++) {
    const key = ((<i64>1) << 40) + i;
    const value = new MutatingValue();
    value.n = i;
    map.set(key, value);
    if (!(i & 1)) map.delete(key);
  }
  wide = map;
  return JSON.stringify(map);
}
