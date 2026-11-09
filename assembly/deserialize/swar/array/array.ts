// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { linkObject } from "../../../util/runtime";
import { newNativeArray } from "../../../util/nativeArray";
import { reuseComposite } from "../../parseMode";
import { JSON } from "../../..";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { deserializeFloatArrayBody } from "./float";
import { ensureArrayField, scanValueEnd, skipWhitespace } from "./shared";
import { skipPrettyWhitespace_SIMD } from "../../../util/prettyWhitespaceSimd";


@inline
function skipNestedArrayWhitespace(srcStart: usize, srcEnd: usize): usize {
  const code = load<u16>(srcStart);
  if (ASC_FEATURE_SIMD && code == 10) {
    // Common JSON.stringify(..., null, 2) shape at Canada's coordinate depth:
    // LF + twelve spaces + the next nested array. Two fixed compares avoid a
    // general whitespace mask, bitmask, and ctz on every coordinate pair.
    if (
      srcStart + 28 <= srcEnd &&
      !v128.any_true(v128.xor(load<v128>(srcStart, 2), i16x8.splat(0x20))) &&
      load<u64>(srcStart, 18) == 0x0020_0020_0020_0020 &&
      load<u16>(srcStart, 26) == BRACKET_LEFT
    )
      return srcStart + 26;
    return skipPrettyWhitespace_SIMD(srcStart, srcEnd);
  }
  return skipWhitespace(srcStart, srcEnd);
}

export function deserializeArrayArrayBody<T extends unknown[][]>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): usize {
  let index = 0;
  const reusableLength = load<i32>(
    changetype<usize>(out),
    offsetof<T>("length_"),
  );
  const reusableDataStart = out.dataStart;
  const elementSize = sizeof<valueof<T>>();

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    if (srcStart < srcEnd) {
      const code = load<u16>(srcStart);
      if (code != BRACKET_LEFT)
        srcStart = skipNestedArrayWhitespace(srcStart, srcEnd);
    }
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return srcStart + 2;
    }

    while (srcStart < srcEnd) {
      if (isFloat<valueof<valueof<T>>>() && !isNullable<valueof<T>>()) {
        let value: valueof<T>;
        if (index < reusableLength) {
          value = load<valueof<T>>(
            reusableDataStart + <usize>index * elementSize,
          );
          const slot = reusableDataStart + <usize>index * elementSize;
          if (!reuseComposite(changetype<usize>(value), slot)) {
            value = newNativeArray<valueof<T>>(2);
            store<valueof<T>>(slot, value);
            linkObject(changetype<usize>(out), changetype<usize>(value), false);
          }
        } else {
          value = changetype<valueof<T>>(newNativeArray<valueof<T>>(2));
          changetype<Array<valueof<T>>>(out)[out.length] = value;
        }
        srcStart = deserializeFloatArrayBody<valueof<T>>(
          srcStart,
          srcEnd,
          value,
        );
        if (!srcStart || srcStart >= srcEnd) break;
      } else if (isArray<valueof<valueof<T>>>() && !isNullable<valueof<T>>()) {
        let value: valueof<T>;
        if (index < reusableLength) {
          value = load<valueof<T>>(
            reusableDataStart + <usize>index * elementSize,
          );
          const slot = reusableDataStart + <usize>index * elementSize;
          if (!reuseComposite(changetype<usize>(value), slot)) {
            value = newNativeArray<valueof<T>>();
            store<valueof<T>>(slot, value);
            linkObject(changetype<usize>(out), changetype<usize>(value), false);
          }
        } else {
          value = changetype<valueof<T>>(newNativeArray<valueof<T>>());
          changetype<Array<valueof<T>>>(out)[out.length] = value;
        }
        srcStart = deserializeArrayArrayBody<valueof<T>>(
          srcStart,
          srcEnd,
          value,
        );
        if (!srcStart || srcStart >= srcEnd) break;
      } else {
        const valueEnd = scanValueEnd(srcStart, srcEnd);
        if (!valueEnd || valueEnd <= srcStart) break;

        let valuePtr: usize = 0;
        if (index < reusableLength) {
          const slot = reusableDataStart + <usize>index * elementSize;
          valuePtr = reuseComposite(load<usize>(slot), slot);
        }
        const value = JSON.__deserializeValue<valueof<T>>(
          srcStart,
          valueEnd,
          valuePtr,
        );
        if (index < reusableLength) {
          store<valueof<T>>(
            reusableDataStart + <usize>index * elementSize,
            value,
          );
        } else {
          changetype<Array<valueof<T>>>(out)[out.length] = value;
        }
        srcStart = valueEnd;
      }

      if (srcStart >= srcEnd) break;
      let code = load<u16>(srcStart);
      if (code != COMMA && code != BRACKET_RIGHT) {
        srcStart = skipWhitespace(srcStart, srcEnd);
        if (srcStart >= srcEnd) break;
        code = load<u16>(srcStart);
      }
      if (code == COMMA) {
        srcStart += 2;
        if (srcStart < srcEnd) {
          code = load<u16>(srcStart);
          if (code != BRACKET_LEFT)
            srcStart = skipNestedArrayWhitespace(srcStart, srcEnd);
        }
        index++;
        continue;
      }
      if (code == BRACKET_RIGHT) {
        // Skip the runtime `ensureCapacity` call when the length is already
        // correct (the array is being reused with the same shape, e.g.
        // canada's geometry rings across repeated parses).
        const nextLen = index + 1;
        if (reusableLength != nextLen) out.length = nextLen;
        return srcStart + 2;
      }
      break;
    }
  } while (false);

  throw new Error("Failed to parse JSON!");
}

export function deserializeArrayArrayField<T extends unknown[][]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeArrayArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
