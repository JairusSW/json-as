// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
let array: JSON.Arr | null = null;
let values: f64[] = [];
let output = "";
export function setup(): void {
  array = new JSON.Arr();
  for (let i = 0; i < 1000; i++) array!.push<i32>(0);
  values = new Array<f64>(20_000);
  values.fill(1);
  output = JSON.stringify(values);
}
export function update(): void {
  for (let i = 0; i < 1000; i++) array!.set<i32>(i, i);
}
export function serializeFloats(): void {
  output = JSON.stringify(values);
}
export function outputBytes(): i32 {
  return output.length << 1;
}
export function check(): bool {
  return array!.getAs<i32>(999) == 999;
}
