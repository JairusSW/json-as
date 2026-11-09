// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { deserializeGenericArray } from "./generic";

// Raw values need exact JSON token ranges, including null and nested values.
export function deserializeRawArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  return deserializeGenericArray<T>(srcStart, srcEnd, dst);
}
