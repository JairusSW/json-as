// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bs } from "../../../lib/as-bs";
import { bytes } from "../../util/bytes";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { u16_to_hex4_swar } from "../../util/swar";
import { serializeStruct } from "./struct";

// @ts-ignore: decorator allowed
@lazy const U00_MARKER = 13511005048209500;
// @ts-ignore: decorator allowed
@lazy const U_MARKER = 7667804;

/**
 * Serializes valid strings into their JSON counterpart
 * @param src string
 * @returns void
 */
export function serializeString_NAIVE(src: string): void {
  serializeStringRange(changetype<usize>(src), bytes(src));
}

/**
 * Serializes a raw UTF-16 range as a quoted, escaped JSON string. Lets callers
 * (e.g. JSON.Obj key serialization) emit a string straight from a buffer slice
 * without first materializing a heap `string`.
 */
@inline
export function serializeStringRange(srcPtr: usize, srcSize: usize): void {
  bs.proposeSize(u32(srcSize + 4));
  serializeStringRangeReserved(srcPtr, srcSize);
}

/** Emits a string whose unescaped payload and quotes are already reserved. */
export function serializeStringRangeReserved(
  srcPtr: usize,
  srcSize: usize,
): void {
  const srcEnd = srcPtr + srcSize;

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  let lastPtr: usize = srcPtr;
  while (srcPtr < srcEnd) {
    const code = load<u16>(srcPtr);
    srcPtr += 2;

    if (code == 34 || code == 92 || code < 32) {
      const remBytes = srcPtr - lastPtr - 2;
      memory.copy(bs.offset, lastPtr, remBytes);
      bs.offset += remBytes;
      const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
      if ((escaped & 0xffff) != BACK_SLASH) {
        bs.growSize(10);
        store<u64>(bs.offset, U00_MARKER, 0);
        store<u32>(bs.offset, escaped, 8);
        bs.offset += 12;
      } else {
        bs.growSize(2);
        store<u32>(bs.offset, escaped, 0);
        bs.offset += 4;
      }
      lastPtr = srcPtr;
      continue;
    }
    // srcPtr += 2;
    if (code < 0xd800 || code > 0xdfff) continue;

    if (code <= 0xdbff) {
      if (srcPtr <= srcEnd - 2) {
        const next = load<u16>(srcPtr);
        if (next >= 0xdc00 && next <= 0xdfff) {
          srcPtr += 2;
          continue;
        }
      }
    }

    const remBytes = srcPtr - lastPtr - 2;
    memory.copy(bs.offset, lastPtr, remBytes);
    bs.offset += remBytes;

    // unpaired high/low surrogate
    bs.growSize(10);
    store<u32>(bs.offset, U_MARKER); // \u
    store<u64>(bs.offset, u16_to_hex4_swar(code), 4);
    bs.offset += 12;
    lastPtr = srcPtr;
    continue;
  }
  const remBytes = srcEnd - lastPtr;
  memory.copy(bs.offset, lastPtr, remBytes);
  bs.offset += remBytes;
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}
