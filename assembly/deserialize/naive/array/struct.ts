// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { deserializeStructArray_SWAR } from "../../swar/array/struct";

// Use the same quote-aware, bounds-taking worker as the public array path.
export function deserializeStructArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  return deserializeStructArray_SWAR<T>(srcStart, srcEnd, dst);
}
