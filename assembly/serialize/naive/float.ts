// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bs } from "../../../lib/as-bs";
import { dtoa_buffered, ftoa_buffered } from "xjb-as";
import { NULL_WORD_U64 } from "../../custom/chars";

// Float serialization is backed by xjb-as (a Schubfach/xjb shortest-decimal
// writer with SWAR + WASM-SIMD digit kernels). The *_buffered writers emit
// UTF-16 straight into the `bs` buffer and return the number of characters
// written, so advancing the offset is `count << 1` bytes.

export function serializeFloat32Unsafe(data: f32): void {
  bs.offset = serializeFloat32At(bs.offset, data);
}


@inline export function serializeFloat32At(dst: usize, data: f32): usize {
  if ((reinterpret<u32>(data) & 0x7f800000) == 0x7f800000) {
    store<u64>(dst, NULL_WORD_U64);
    return dst + 8;
  }
  return dst + (ftoa_buffered(dst, data) << 1);
}

export function serializeFloat64Unsafe(data: f64): void {
  bs.offset = serializeFloat64At(bs.offset, data);
}


@inline export function serializeFloat64At(dst: usize, data: f64): usize {
  if ((reinterpret<u64>(data) & 0x7ff0000000000000) == 0x7ff0000000000000) {
    store<u64>(dst, NULL_WORD_U64);
    return dst + 8;
  }
  return dst + (dtoa_buffered(dst, data) << 1);
}

export function serializeFloat32(data: f32): void {
  if ((reinterpret<u32>(data) & 0x7f800000) == 0x7f800000) {
    bs.proposeSize(8);
    store<u64>(bs.offset, NULL_WORD_U64);
    bs.offset += 8;
    return;
  }
  bs.ensureSize(128);
  const bytes = ftoa_buffered(bs.offset, data) << 1;
  bs.stackSize += bytes;
  bs.offset += bytes;
}

export function serializeFloat64(data: f64): void {
  if ((reinterpret<u64>(data) & 0x7ff0000000000000) == 0x7ff0000000000000) {
    bs.proposeSize(8);
    store<u64>(bs.offset, NULL_WORD_U64);
    bs.offset += 8;
    return;
  }
  bs.ensureSize(128);
  const bytes = dtoa_buffered(bs.offset, data) << 1;
  bs.stackSize += bytes;
  bs.offset += bytes;
}
