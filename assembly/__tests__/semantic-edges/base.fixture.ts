// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

const INITIAL_COUNT: i32 = 7;
let calls: i32 = 0;
function initial(): i32 {
  calls++;
  return INITIAL_COUNT;
}
export function reset(): void {
  calls = 0;
}
export function count(): i32 {
  return calls;
}
export class Base<T> {
  value: T = changetype<T>(initial());
}
