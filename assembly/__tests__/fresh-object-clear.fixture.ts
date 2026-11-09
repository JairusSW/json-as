// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { allocateObject, clearAllocatedObject } from "../util/runtime";
import { OBJECT_OVERHEAD } from "rt/common";
import { JSON } from "../index";

class Payload { a: u64 = 0; b: u64 = 0; c: u64 = 0; d: u64 = 0; }
@json class Child { @optional n: i32 = 7; @optional values: i32[] | null = null; }
@json class Holder { child: Child | null = null; rows: Child[] = []; }

export function verify(): i32 {
  const size = offsetof<Payload>();
  // Warm collector metadata before putting a dirty block on the native free list.
  const warm = allocateObject(size, idof<Payload>());
  clearAllocatedObject(warm, size);
  let dirtyBefore = 0;
  for (let turn = 0; turn < 128; turn++) {
    const raw = __alloc(OBJECT_OVERHEAD + size);
    memory.fill(raw + OBJECT_OVERHEAD, 0xa5, size);
    __free(raw);
    const ptr = allocateObject(size, idof<Payload>());
    if (load<u64>(ptr) != 0) dirtyBefore++;
    clearAllocatedObject(ptr, size);
    for (let offset: usize = 0; offset < size; offset += 8)
      assert(load<u64>(ptr + offset) == 0);
    if ((turn & 7) == 0) __collect();
  }
  // Minimal reuses uncleared native blocks. This proves its explicit fallback
  // was exercised rather than merely observing zeroed virgin memory.
  if (ASC_RUNTIME == 1) assert(dirtyBefore > 0);
  for (let turn = 0; turn < 64; turn++) {
    const parsed = JSON.parse<Holder>('{"child":{},"rows":[{}, {"n":9}]}');
    __collect();
    assert(parsed.child !== null && parsed.child!.n == 7 && parsed.child!.values === null);
    assert(parsed.rows.length == 2 && parsed.rows[0].n == 7 && parsed.rows[1].n == 9);
    assert(parsed.rows[0].values === null && parsed.rows[1].values === null);
  }
  return 1;
}
