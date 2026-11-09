// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { STRING_SIZE_MASK } from "./runtime";

export function bytes<T>(o: T): i32 {
  if (isInteger<T>() || isFloat<T>()) {
    return sizeof<T>();
  } else if (isManaged<T>() || isReference<T>()) {
    const size = changetype<OBJECT>(
      changetype<usize>(o) - TOTAL_OVERHEAD,
    ).rtSize;
    return isString<nonnull<T>>() ? size & STRING_SIZE_MASK : size;
  } else {
    throw new Error("Cannot convert type " + nameof<T>() + " to bytes!");
  }
}
