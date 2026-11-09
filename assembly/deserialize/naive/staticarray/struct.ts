// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import {
  BRACE_LEFT,
  BRACE_RIGHT,
  BRACKET_LEFT,
  BRACKET_RIGHT,
} from "../../../custom/chars";
import { JSON } from "../../..";
import { isSpace } from "util/string";

export function deserializeStaticArrayStruct<T extends StaticArray<any>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (srcStart - srcEnd == 0)
    throw new Error("Input string had zero length or was all whitespace");

  if (load<u16>(srcStart) != BRACKET_LEFT)
    throw new Error(
      "Expected '[' at start of object at position " +
        (srcEnd - srcStart).toString(),
    );
  if (load<u16>(srcEnd - 2) != BRACKET_RIGHT)
    throw new Error(
      "Expected ']' at end of object at position " +
        (srcEnd - srcStart).toString(),
    );

  // First pass: count elements using same logic as Array deserializer
  let count: i32 = 0;
  let depth: u32 = 0;
  let ptr = srcStart;
  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code == BRACE_LEFT && depth++ == 0) {
      // start of object
    } else if (code == BRACE_RIGHT && --depth == 0) {
      count++;
    }
    ptr += 2;
  }

  // Allocate StaticArray with correct size
  const outSize = count * sizeof<valueof<T>>();
  const out = changetype<nonnull<T>>(dst || __new(outSize, idof<T>()));

  // Second pass: populate values
  let index = 0;
  let lastIndex: usize = 0;
  depth = 0;
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code == BRACE_LEFT && depth++ == 0) {
      lastIndex = srcStart;
    } else if (code == BRACE_RIGHT && --depth == 0) {
      unchecked(
        (out[index++] = JSON.__deserializeValue<valueof<T>>(
          lastIndex,
          (srcStart += 2),
        )),
      );
    }
    srcStart += 2;
  }

  return out;
}
