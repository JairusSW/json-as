// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { atoi } from "../../util/atoi";

export function deserializeUnsigned_NAIVE<T extends number>(
  srcStart: usize,
  srcEnd: usize,
): T {
  return atoi<T>(srcStart, srcEnd);
}

export function deserializeUnsignedField_NAIVE<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const fieldPtr = dstObj + dstOffset;
  if (srcStart >= srcEnd) return 0;
  let digit = <u32>load<u16>(srcStart) - 48;
  if (digit > 9) return 0;

  if (sizeof<T>() == sizeof<u8>()) {
    let value: u64 = digit;
    srcStart += 2;
    while (srcStart < srcEnd) {
      digit = <u32>load<u16>(srcStart) - 48;
      if (digit > 9) break;
      value = value * 10 + digit;
      srcStart += 2;
    }
    store<u8>(fieldPtr, <u8>value);
    return srcStart;
  } else if (sizeof<T>() == sizeof<u16>()) {
    let value: u64 = digit;
    srcStart += 2;
    while (srcStart < srcEnd) {
      digit = <u32>load<u16>(srcStart) - 48;
      if (digit > 9) break;
      value = value * 10 + digit;
      srcStart += 2;
    }
    store<u16>(fieldPtr, <u16>value);
    return srcStart;
  } else if (sizeof<T>() == sizeof<u32>()) {
    let value: u64 = digit;
    srcStart += 2;
    while (srcStart < srcEnd) {
      digit = <u32>load<u16>(srcStart) - 48;
      if (digit > 9) break;
      value = value * 10 + digit;
      srcStart += 2;
    }
    store<u32>(fieldPtr, <u32>value);
    return srcStart;
  } else {
    let value: u64 = digit;
    srcStart += 2;
    while (srcStart < srcEnd) {
      digit = <u32>load<u16>(srcStart) - 48;
      if (digit > 9) break;
      value = value * 10 + digit;
      srcStart += 2;
    }
    if (sizeof<T>() == sizeof<usize>()) {
      store<usize>(fieldPtr, <usize>value);
    } else {
      store<u64>(fieldPtr, value);
    }
    return srcStart;
  }
}
