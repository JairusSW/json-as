// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../assembly";
import { deserializeIntegerField_SWAR } from "../../assembly/deserialize/swar/integer";
import { deserializeIntegerField_SIMD } from "../../assembly/deserialize/simd/integer";

const input = new ArrayBuffer(512);
const output = memory.data(16);

export function source(): usize {
  return changetype<usize>(input);
}
export function destination(): usize {
  return output;
}

export function read(
  backend: i32,
  kind: i32,
  start: usize,
  end: usize,
  offset: usize,
): i32 {
  memory.fill(output, 0xcc, 16);
  let next: usize = 0;
  if (backend == 0) {
    if (kind == 0)
      next = deserializeIntegerField_SWAR<i8>(start, end, output, offset);
    else if (kind == 1)
      next = deserializeIntegerField_SWAR<i16>(start, end, output, offset);
    else if (kind == 2)
      next = deserializeIntegerField_SWAR<i32>(start, end, output, offset);
    else if (kind == 3)
      next = deserializeIntegerField_SWAR<i64>(start, end, output, offset);
    else if (kind == 4)
      next = deserializeIntegerField_SWAR<u64>(start, end, output, offset);
    else next = deserializeIntegerField_SWAR<usize>(start, end, output, offset);
  } else {
    if (kind == 0)
      next = deserializeIntegerField_SIMD<i8>(start, end, output, offset);
    else if (kind == 1)
      next = deserializeIntegerField_SIMD<i16>(start, end, output, offset);
    else if (kind == 2)
      next = deserializeIntegerField_SIMD<i32>(start, end, output, offset);
    else if (kind == 3)
      next = deserializeIntegerField_SIMD<i64>(start, end, output, offset);
    else if (kind == 4)
      next = deserializeIntegerField_SIMD<u64>(start, end, output, offset);
    else next = deserializeIntegerField_SIMD<usize>(start, end, output, offset);
  }
  return next ? <i32>(next - start) : -1;
}


@json
class Row {
  value: i64 = 0;
  tail: i32 = 0;
}

export function api(): bool {
  const fresh = JSON.parse<Row>('{"value":-123456789,"tail":7}');
  if (fresh.value != -123456789 || fresh.tail != 7) return false;
  const reused = JSON.parse<Row>('{"value":987654321,"tail":8}', fresh);
  if (reused !== fresh || reused.value != 987654321 || reused.tail != 8)
    return false;
  const rows = JSON.parse<Row[]>('[{"value":123456789,"tail":9}]');
  return rows[0].value == 123456789 && rows[0].tail == 9;
}
