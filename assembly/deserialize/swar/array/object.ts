// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { setNativeArrayLength } from "../../../util/nativeArray";
import { reuseComposite } from "../../parseMode";
import { JSON } from "../../..";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import {
  ensureArrayElementSlot,
  ensureArrayField,
  scanValueEnd,
  skipWhitespace,
} from "./shared";

function deserializeObjectArrayBody<T extends unknown[]>(
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
    srcStart = skipWhitespace(srcStart, srcEnd);
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
      const valueStart = srcStart;
      const valueEnd = scanValueEnd(valueStart, srcEnd);
      if (!valueEnd) break;

      const value = JSON.__deserializeValue<valueof<T>>(
        valueStart,
        valueEnd,
        reuseComposite(load<usize>(slot), slot),
      );
      store<valueof<T>>(slot, value);
      srcStart = valueEnd;

      srcStart = skipWhitespace(srcStart, srcEnd);
      if (srcStart >= srcEnd) break;
      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        srcStart = skipWhitespace(srcStart, srcEnd);
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

  throw new Error("Failed to parse JSON!");
}

export function deserializeObjectArrayField<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeObjectArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
