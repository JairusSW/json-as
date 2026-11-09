// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { newEmptyArray } from "../util/emptyArray";
import { newNativeArray } from "../util/nativeArray";


@json
class EmptyOwner {
  n!: i32;
  a!: i64[];
  b!: i64[];
}

let retained: EmptyOwner | null = null;
export function parseEmpty(): i32 {
  retained = JSON.parse<EmptyOwner>('{"n":1,"a":[],"b":[]}');
  assert(retained!.a !== retained!.b);
  return retained!.a.length + retained!.b.length;
}
export function mutate(): i32 {
  const value = retained!;
  for (let i = 0; i < 100; i++) value.a.push(i);
  __collect();
  assert(value.b.length == 0);
  value.b.push(999);
  __collect();
  for (let i = 0; i < 100; i++) assert(value.a[i] == i);
  assert(value.b[0] == 999);
  value.a.length = 0;
  value.a.push(7);
  assert(value.b[0] == 999 && value.a[0] == 7);
  return 1;
}

function scalarStorage<T extends number>(): void {
  const a = newEmptyArray<Array<T>>();
  const b = newEmptyArray<Array<T>>();
  __pin(changetype<usize>(a));
  __pin(changetype<usize>(b));
  assert(a !== b && a.length == 0 && b.length == 0);
  for (let i = 0; i < 100; i++) a.push(<T>i);
  __collect();
  b.push(<T>99);
  for (let i = 0; i < 100; i++) assert(a[i] == <T>i);
  assert(b[0] == <T>99);
  __unpin(changetype<usize>(a));
  __unpin(changetype<usize>(b));
  const native = newNativeArray<Array<T>>();
  __pin(changetype<usize>(native));
  assert(native.length == 0);
  assert(native.byteLength == (<i32>8) << alignof<T>());
  for (let i = 0; i < 100; i++) native.push(<T>i);
  __collect();
  for (let i = 0; i < 100; i++) assert(native[i] == <T>i);
  __unpin(changetype<usize>(native));
}


@json
class SubtypeOwner {
  value!: Subtype;
}
class Subtype extends Array<i32> {
  tag: i32 = 7;
  constructor() {
    super();
    this.push(5);
  }
}
export function verifyStorage(): i32 {
  scalarStorage<i8>();
  scalarStorage<u8>();
  scalarStorage<i16>();
  scalarStorage<u16>();
  scalarStorage<i32>();
  scalarStorage<u32>();
  scalarStorage<i64>();
  scalarStorage<u64>();
  scalarStorage<f32>();
  scalarStorage<f64>();
  const a = newEmptyArray<string[]>();
  const b = newEmptyArray<string[]>();
  __pin(changetype<usize>(a));
  __pin(changetype<usize>(b));
  a.push("retained".repeat(64));
  __collect();
  b.push("other".repeat(64));
  __collect();
  assert(a[0] == "retained".repeat(64) && b[0] == "other".repeat(64));
  __unpin(changetype<usize>(a));
  __unpin(changetype<usize>(b));
  const sub = newEmptyArray<Subtype>();
  assert(sub.tag == 7 && sub.length == 1 && sub[0] == 5);
  const nativeSub = newNativeArray<Subtype>();
  assert(nativeSub.tag == 7 && nativeSub.length == 1 && nativeSub[0] == 5);
  const nativeRefs = newNativeArray<string[]>();
  __pin(changetype<usize>(nativeRefs));
  for (let i = 0; i < 128; i++) nativeRefs.push(i.toString().repeat(64));
  __collect();
  for (let i = 0; i < 128; i++)
    assert(nativeRefs[i] == i.toString().repeat(64));
  __unpin(changetype<usize>(nativeRefs));
  const parsed = JSON.parse<SubtypeOwner>('{"value":[]}');
  assert(parsed.value.tag == 7 && parsed.value.length == 0);
  return 1;
}

let factoryResult: i64[] | null = null;
export function allocateNative(): i32 {
  factoryResult = newNativeArray<i64[]>();
  return factoryResult!.byteLength;
}
export function readNative(): i32 {
  assert(factoryResult!.length == 0);
  factoryResult!.push(42);
  __collect();
  return <i32>factoryResult![0];
}

export function verifyReuse(): i32 {
  retained = JSON.parse<EmptyOwner>('{"n":1,"a":[],"b":[]}');
  const first = retained!.a;
  JSON.parse<EmptyOwner>('{"n":2,"a":[1,2,3],"b":[4]}', retained!);
  assert(retained!.a === first && retained!.a[2] == 3 && retained!.b[0] == 4);
  JSON.parse<EmptyOwner>('{"n":3,"a":[],"b":[]}', retained!);
  __collect();
  assert(retained!.a.length == 0 && retained!.b.length == 0);
  retained!.a.push(42);
  assert(retained!.a[0] == 42 && retained!.b.length == 0);
  return 1;
}
