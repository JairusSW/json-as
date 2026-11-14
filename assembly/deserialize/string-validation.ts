// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

@inline
function isHexDigit(c: u16): bool {
  return (
    (c >= 0x30 && c <= 0x39) ||
    (c >= 0x41 && c <= 0x46) ||
    (c >= 0x61 && c <= 0x66)
  );
}

/** Validate one escape beginning at its backslash without scanning plain text. */
export function isValidStringEscape(srcStart: usize, srcEnd: usize): bool {
  if (srcStart + 4 > srcEnd) return false;
  const code = load<u16>(srcStart, 2);
  if (code == 0x75) {
    return (
      srcStart + 12 <= srcEnd &&
      isHexDigit(load<u16>(srcStart, 4)) &&
      isHexDigit(load<u16>(srcStart, 6)) &&
      isHexDigit(load<u16>(srcStart, 8)) &&
      isHexDigit(load<u16>(srcStart, 10))
    );
  }
  return (
    code == 0x22 ||
    code == 0x5c ||
    code == 0x2f ||
    code == 0x62 ||
    code == 0x66 ||
    code == 0x6e ||
    code == 0x72 ||
    code == 0x74
  );
}
