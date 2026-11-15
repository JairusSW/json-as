// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { computePow10, gPow10Hi } from "xjb-as/assembly/xjb";
export function low(index: i32): u64 {
  return computePow10(index);
}
export function high(): u64 {
  return gPow10Hi;
}
export function table(raw: i32, slot: i32): u64 {
  // @ts-expect-error: the test observer supplies this global.
  return __json_decimal_test_frame(raw, slot);
}
export function stock(raw: i32, slot: i32): u64 {
  const q = raw - 1075;
  const decExp = ((raw - 1075) * 78913) >> 18;
  const powExp = -decExp - 1;
  const h = q + ((powExp * 217707) >> 16);
  const shift = h + 1 + 6;
  const low = computePow10(powExp + 293) + u64(powExp < 0);
  const high = gPow10Hi;
  if (slot == 0) return high;
  if (slot == 1) return low;
  if (slot == 2) return (<u64>(<u32>decExp)) | ((<u64>(<u32>shift)) << 32);
  return <u64>(<u32>h);
}
