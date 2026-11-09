// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

/**
 * ATOI optimized for non-exponential integers
 * @param str
 * @returns
 */
export function atoi<T>(srcStart: usize, srcEnd: usize): T {
  // @ts-ignore: type
  let val: T = 0;
  if (isSigned<T>()) {
    if (load<u16>(srcStart) == 45) {
      srcStart += 2;
      while (srcStart < srcEnd) {
        // @ts-ignore: type
        val = (val * 10 + (load<u16>(srcStart) - 48)) as T;
        srcStart += 2;
      }
      return -val as T;
    } else {
      while (srcStart < srcEnd) {
        // @ts-ignore: type
        val = (val * 10 + (load<u16>(srcStart) - 48)) as T;
        srcStart += 2;
      }
      return val as T;
    }
  } else {
    while (srcStart < srcEnd) {
      // @ts-ignore: type
      val = (val * 10 + (load<u16>(srcStart) - 48)) as T;
      srcStart += 2;
    }
    return val as T;
  }
}
