// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { BACK_SLASH, QUOTE } from "../custom/chars";

export function isUnescapedQuote(ptr: usize): bool {
  if (load<u16>(ptr) != QUOTE) return false;

  let escaped = false;
  while (ptr >= 2 && load<u16>(ptr - 2) == BACK_SLASH) {
    escaped = !escaped;
    ptr -= 2;
  }

  return !escaped;
}

export function scanStringEnd(ptr: usize, end: usize): usize {
  ptr += 2;
  while (ptr < end) {
    if (load<u16>(ptr) == QUOTE && isUnescapedQuote(ptr)) return ptr;
    ptr += 2;
  }
  return end;
}
