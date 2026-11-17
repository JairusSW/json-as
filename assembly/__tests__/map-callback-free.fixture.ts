// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { canSnapshotCallbackKeys } from "../util/runtime";
import { canSerializeMapWithoutCallbacks } from "../serialize/naive/map";


@json
class Leaf {
  n: i32 = 7;
  text: string = "ok";
}


@json
class Graph {
  leaf: Leaf | null = new Leaf();
  numbers: i32[] = [1, 2];
  strings: (string | null)[] = ["x", null];
}

class DerivedLeaf extends Leaf {}
class ManualLeaf extends Leaf {
  __SERIALIZE(_ptr: usize): void {
    calls++;
    JSON.__serialize<i32>(this.n);
  }
}
class DerivedNumbers extends Array<i32> {}
class ManualNumbers extends Array<i32> {
  __SERIALIZE(_ptr: usize): void {
    calls++;
    JSON.__serialize<i32>(9);
  }
}


@json
class Generic<T> {
  value: T = <T>7;
}


@json
class Empty {}


@unmanaged
class UnmanagedKey {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  __SERIALIZE(_ptr: usize): void {
    calls++;
    JSON.__serialize<i32>(this.n);
  }
}

let active: Map<string, Leaf> | null = null;
let calls: i32 = 0;


@json
class MutatingLeaf extends Leaf {

  @serializer("number")
  encode(self: MutatingLeaf): string {
    calls++;
    if (active !== null) {
      const map = active!;
      active = null;
      map.delete("gone");
      for (let i = 0; i < 256; i++) map.set("new" + i.toString(), new Leaf());
      if (ASC_RUNTIME == 2) __collect();
    }
    return self.n.toString();
  }
}


@json
class Omission {

  @omitif((_self: Omission): bool => { calls++; return false; })
  n: i32 = 9;
}


@json
class Deferred {
  value: JSON.Lazy<i32> = 9;
}


@json
class Cycle {
  next: Cycle | null = null;
}

class HiddenMap extends Map<string, Graph> {
  keys(): string[] {
    return [];
  }
  values(): Graph[] {
    return [];
  }
  get size(): i32 {
    return 0;
  }
}

export function enabled(): bool {
  return canSnapshotCallbackKeys();
}

export function eligible(kind: i32): bool {
  if (kind == 0) {
    const map = new HiddenMap();
    map.set("a", new Graph());
    map.set("deleted", new Graph());
    map.delete("deleted");
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 1) {
    const graph = new Graph();
    graph.leaf = new DerivedLeaf();
    const map = new Map<string, Graph>();
    map.set("a", graph);
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 2) {
    const graph = new Graph();
    graph.numbers = new DerivedNumbers();
    const map = new Map<string, Graph>();
    map.set("a", graph);
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 3) {
    const map = new Map<string, Leaf>();
    map.set("first", new Leaf());
    map.set("later", new MutatingLeaf());
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 4) {
    const map = new Map<string, Omission>();
    map.set("a", new Omission());
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 5) {
    const map = new Map<string, Deferred>();
    map.set("a", new Deferred());
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 6) {
    const value = new Cycle();
    value.next = value;
    const map = new Map<string, Cycle>();
    map.set("a", value);
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 7) {
    const map = new Map<string, i32[]>();
    map.set("a", [1, 2]);
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 9) {
    const map = new Map<string, ManualLeaf>();
    map.set("a", new ManualLeaf());
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 10) {
    const map = new Map<string, ManualNumbers>();
    map.set("a", new ManualNumbers());
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 11) {
    const map = new Map<string, Generic<i32>>();
    map.set("a", new Generic<i32>());
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 12) {
    const map = new Map<UnmanagedKey, Leaf>();
    map.set(new UnmanagedKey(7), new Leaf());
    return canSerializeMapWithoutCallbacks(map);
  }
  if (kind == 13) {
    const map = new Map<string, Empty>();
    map.set("a", new Empty());
    return canSerializeMapWithoutCallbacks(map);
  }
  const map = new Map<string, Leaf | null>();
  map.set("a", null);
  return canSerializeMapWithoutCallbacks(map);
}

export function legacyMode(kind: i32): bool {
  if (kind == 0) return new Leaf().__SERIALIZE_PURE_TYPE() == idof<Leaf>();
  if (kind == 1) return new Graph().__SERIALIZE_PURE_TYPE() == 0;
  if (kind == 2) return new Empty().__SERIALIZE_PURE_TYPE() == idof<Empty>();
  return new DerivedLeaf().__SERIALIZE_PURE_TYPE() != idof<DerivedLeaf>();
}

export function run(kind: i32): string {
  calls = 0;
  if (kind == 0) {
    const map = new HiddenMap();
    map.set("a", new Graph());
    map.set("deleted", new Graph());
    map.delete("deleted");
    const out = JSON.stringify(map);
    __pin(changetype<usize>(out));
    map.clear();
    if (ASC_RUNTIME != 0) __collect();
    __unpin(changetype<usize>(out));
    return out;
  }
  if (kind == 1) {
    const map = new Map<string, Leaf>();
    map.set("first", new Leaf());
    map.set("effect", new MutatingLeaf());
    map.set("gone", new Leaf());
    active = map;
    return JSON.stringify(map) + "|" + calls.toString();
  }
  if (kind == 2) {
    const graph = new Graph();
    graph.leaf = new MutatingLeaf();
    const map = new Map<string, Graph>();
    map.set("a", graph);
    return JSON.stringify(map) + "|" + calls.toString();
  }
  if (kind == 4) {
    const map = new Map<string, ManualLeaf>();
    map.set("a", new ManualLeaf());
    return JSON.stringify(map) + "|" + calls.toString();
  }
  if (kind == 5) {
    const map = new Map<string, ManualNumbers>();
    map.set("a", new ManualNumbers());
    return JSON.stringify(map) + "|" + calls.toString();
  }
  if (kind == 6) {
    const map = new Map<UnmanagedKey, Leaf>();
    map.set(new UnmanagedKey(7), new Leaf());
    return JSON.stringify(map) + "|" + calls.toString();
  }
  if (kind == 7) {
    const leaf = new Leaf();
    const boxed = JSON.Value.from<Leaf>(leaf);
    const first = JSON.stringify(boxed);
    leaf.n = 11;
    return first + "|" + JSON.stringify(boxed);
  }
  if (kind == 8) return JSON.stringify(JSON.Value.from<Graph>(new Graph()));
  const map = new Map<string, Omission>();
  map.set("a", new Omission());
  return JSON.stringify(map) + "|" + calls.toString();
}


@global
export function finalizeSnapshotObject(_ptr: usize): void {}
