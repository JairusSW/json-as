// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

export function deserializeUintScan<T extends number>(
  src: usize,
  dst: usize,
): usize {
  let digit = <T>load<u16>(src) - 48;
  if (digit > 9) abort("Found invalid digit");
  let val = digit;
  src += 2;
  while ((digit = <u32>load<u16>(src) - 48) < 10) {
    val = val * 10 + digit;
    src += 2;
  }
  store<T>(dst, val);
  return src;
}
