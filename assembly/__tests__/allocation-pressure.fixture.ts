// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { smallBatchReservedBytes } from "../util/runtime";
let before: usize = 0;
let afterBytes: usize = 0;
export function beforeTail(): usize {
  return before;
}
export function afterTail(): usize {
  return afterBytes;
}


@json
class Small {
  value: i32 = 0;
}
let ballast: Uint8Array | null = null;
let buffer: ArrayBuffer | null = null;
let retained: Small | null = null;

export function verify(after: bool, reserve: i32, view: bool): i32 {
  if (after) retained = JSON.parse<Small>('{"value":7}');
  const bytes = <i32>(((<usize>memory.size()) << 16) - __heap_base) - reserve;
  before = smallBatchReservedBytes();
  if (view) ballast = new Uint8Array(bytes);
  else buffer = new ArrayBuffer(bytes);
  afterBytes = smallBatchReservedBytes();
  if (!after) retained = JSON.parse<Small>('{"value":7}');
  for (let i = 0; i < 200; i++) {
    const value = JSON.parse<Small>('{"value":9}');
    if (value.value != 9 || retained!.value != 7 || value === retained)
      return 1;
    __collect();
  }
  if (view) {
    ballast![ballast!.length - 1] = 123;
    return ballast![ballast!.length - 1] == 123 ? 0 : 2;
  }
  store<u8>(changetype<usize>(buffer) + buffer!.byteLength - 1, 123);
  return load<u8>(changetype<usize>(buffer) + buffer!.byteLength - 1) == 123
    ? 0
    : 2;
}
