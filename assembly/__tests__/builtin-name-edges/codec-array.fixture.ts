// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";
let calls: i32 = 0;


@json
export class Array<T> {
  value: T = changetype<T>(3);


  @serializer("object")
  encode(_self: Array<T>): string {
    calls++;
    return '{"value":7}';
  }
}


@json
class Holder {
  child: Array<i32> = new Array<i32>();
}
export function run(kind: i32): i32 {
  if (kind == 0) return JSON.parse<Array<i32>>('{"value":7}').value;
  if (kind == 1)
    return JSON.parse<Array<i32>>('{"value":7}', new Array<i32>()).value;
  if (kind == 2) return JSON.parse<Holder>('{"child":{"value":7}}').child.value;
  return JSON.parse<Holder>('{"child":{"value":7}}', new Holder()).child.value;
}
export function roundtrip(): string {
  calls = 0;
  const result = JSON.stringify(JSON.parse<Holder>('{"child":{"value":7}}'));
  assert(calls == 1);
  return result;
}
