// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { setNativeArrayLength } from "../../../util/nativeArray";
import {
  BRACKET_LEFT,
  BRACKET_RIGHT,
  COMMA,
  FALSE_WORD_U64,
  TRUE_WORD_U64,
} from "../../../custom/chars";
import { isSpace } from "../../../util";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";
import { markProductionParseError } from "../../error";

function deserializeBooleanArrayBody<T extends boolean[]>(
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
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      setNativeArrayLength<T>(out, 0);
      return srcStart + 2;
    }

    while (srcStart < srcEnd) {
      const slot =
        index < reusableLength
          ? reusableDataStart + <usize>index * elementSize
          : ensureArrayElementSlot<T>(out, index);
      const block = load<u64>(srcStart);
      if (block == TRUE_WORD_U64) {
        store<valueof<T>>(slot, true);
        srcStart += 8;
      } else if (block == FALSE_WORD_U64) {
        store<valueof<T>>(slot, false);
        srcStart += 10;
      } else {
        break;
      }

      while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
      if (srcStart >= srcEnd) break;
      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
        index++;
        continue;
      }
      if (code == BRACKET_RIGHT) {
        const nextLen = index + 1;
        if (reusableLength != nextLen) setNativeArrayLength<T>(out, nextLen);
        return srcStart + 2;
      }
      break;
    }
  } while (false);

  markProductionParseError();
  return 0;
}

export function deserializeBooleanArrayField<T extends boolean[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeBooleanArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
