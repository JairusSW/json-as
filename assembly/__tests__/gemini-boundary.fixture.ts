// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON, JSONMode } from "../index";
import { bs } from "../../lib/as-bs";
import { serializeStringRangeReserved_SWAR } from "../serialize/swar/string";
import { serializeStringRangeReserved_SIMD } from "../serialize/simd/string";
import { snp } from "../util/snp";
import { POW_TEN_TABLE_32, POW_TEN_TABLE_64 } from "../globals/tables";

export function boundary(kind: i32): usize {
  bs.reset();
  bs.ensureSize(4096);
  memory.grow(1);
  const size: usize = JSON_MODE == JSONMode.SIMD ? 18 : 10;
  const start = ((<usize>memory.size()) << 16) - size;
  for (let i: usize = 0; i < size; i += 2) store<u16>(start + i, 97);
  store<u16>(start + size - 4, kind == 0 ? 34 : kind == 1 ? 1 : 0xd800);
  if (JSON_MODE == JSONMode.SIMD)
    serializeStringRangeReserved_SIMD(start, <u32>size);
  else serializeStringRangeReserved_SWAR(start, <u32>size);
  return changetype<usize>(bs.out<string>());
}
export function tables(): bool {
  let expected: u64 = 1;
  for (let i: usize = 0; i < 20; i++) {
    if (load<u64>(POW_TEN_TABLE_64 + (i << 3)) != expected) return false;
    if (i < 10 && load<u32>(POW_TEN_TABLE_32 + (i << 2)) != <u32>expected)
      return false;
    expected *= 10;
  }
  return true;
}
export function numbers(): bool {
  const f = "1.5",
    s = "-12e2",
    u = "12e2",
    fraction = "12e-1";
  return (
    snp<f64>(changetype<usize>(f), changetype<usize>(f) + 6) == 1.5 &&
    snp<f32>(changetype<usize>(f), changetype<usize>(f) + 6) == <f32>1.5 &&
    snp<i32>(changetype<usize>(s), changetype<usize>(s) + 10) == -1200 &&
    snp<u64>(changetype<usize>(u), changetype<usize>(u) + 8) == 1200 &&
    snp<i64>(changetype<usize>(fraction), changetype<usize>(fraction) + 10) == 1
  );
}
