// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

/** Return the first non-ASCII-digit cursor within a UTF-16 input range.
 * Full 16-bit lanes matter: a non-ASCII code unit with a digit's low byte is
 * still a delimiter. All lanes preceding the first failure are in [0,9], so
 * subtraction/addition cannot borrow/carry into an earlier lane. The first
 * nonzero masked lane therefore identifies the exact stopping position. */
@inline
export function scanDigits(ptr: usize, end: usize): usize {
  if (ptr >= end) return ptr;
  let remaining = end - ptr;
  while (remaining >= 8) {
    const digits = load<u64>(ptr) - 0x0030_0030_0030_0030;
    const stop =
      (digits | (digits + 0x0006_0006_0006_0006)) & 0xfff0_fff0_fff0_fff0;
    if (stop) return ptr + ((usize(ctz(stop)) >> 4) << 1);
    ptr += 8;
    remaining -= 8;
  }
  while (remaining >= 2 && <u32>(load<u16>(ptr) - 48) <= 9) {
    ptr += 2;
    remaining -= 2;
  }
  return ptr;
}
