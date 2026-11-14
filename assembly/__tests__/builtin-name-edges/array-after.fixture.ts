// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";


@json
class Holder {
  child: Array<i32> = new Array<i32>();
}


@json
export class Array<T> {
  value: T = changetype<T>(3);
}

export function run(kind: i32): i32 {
  if (kind == 0) return JSON.parse<Array<i32>>('{"value":7}').value;
  if (kind == 1)
    return JSON.parse<Array<i32>>('{"value":7}', new Array<i32>()).value;
  if (kind == 2) return JSON.parse<Holder>('{"child":{"value":7}}').child.value;
  return JSON.parse<Holder>('{"child":{"value":7}}', new Holder()).child.value;
}
export function roundtrip(): string {
  return JSON.stringify(JSON.parse<Holder>('{"child":{"value":7}}'));
}
