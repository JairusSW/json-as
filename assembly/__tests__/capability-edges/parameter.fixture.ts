// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
type Item = JSON.Lazy<i32>;


@json class Row<Item> {
  value!: Item;
}
function kind<T>(value: T): string {
  return isFloat<T>() ? "float" : "integer";
}
export function run(): string {
  const row = JSON.parse<Row<f32>>('{"value":1.5}');
  return kind(row.value) + ":" + row.value.toString();
}
