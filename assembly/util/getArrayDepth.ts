// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

/**
 * A terrible function which ascertains the depth of a certain array
 * Depending on the optimization level, this can be essentially nop
 * @returns depth of array
 */

// @ts-ignore: Decorator
export function getArrayDepth<T extends ArrayLike>(depth: i32 = 1): i32 {
  if (!isArray<T>()) {
    return 0;
  } else if (isArray<valueof<T>>()) {
    depth++;
    return getArrayDepth<valueof<T>>(depth);
  } else {
    return depth;
  }
}
