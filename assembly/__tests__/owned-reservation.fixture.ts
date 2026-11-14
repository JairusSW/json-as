// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";


@json
class Row {
  a: i64 = 1;
  b: i64 = 2;
  c: i64 = 3;
}
const rows: Row[] = [];
export function setup(): void {
  resize(3000);
}
export function resize(count: i32): void {
  rows.length = 0;
  for (let i = 0; i < count; i++) rows.push(new Row());
}
export function serialize(): string {
  return JSON.stringify(rows);
}
