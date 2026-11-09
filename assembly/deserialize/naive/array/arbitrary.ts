// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { newNativeArray } from "../../../util/nativeArray";
import { JSON } from "../../../";
import { parseArrayBody } from "../object";

export function deserializeArbitraryArray<T extends JSON.Value[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<T>(dst || changetype<usize>(newNativeArray<T>()));
  out.length = 0;
  // Skip the opening '[' and parse elements single-pass until the matching ']'.
  return parseArrayBody(out, srcStart + 2, srcEnd) != 0
    ? out
    : changetype<T>(0);
}
