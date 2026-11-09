// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// A fixed u32 length handles long JSON property names without adding a
// sentinel branch to every ordinary key lookup or serialization step.
export const KEY_HEADER_UNITS: i32 = 2;


@inline
export function keyLength(ptr: usize): i32 {
  return load<i32>(ptr);
}
