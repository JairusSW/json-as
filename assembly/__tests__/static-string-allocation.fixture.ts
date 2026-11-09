// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";


@json class DynamicStrings {
  items: string[] = [];
}


@json class StaticStrings {
  items: StaticArray<string> = [];
}
const dynamic = new DynamicStrings();
const fixed = new StaticStrings();
let source = "";
export function setup(length: i32): void {
  const values = new Array<string>();
  for (let i = 0; i < length; i++) values.push(i.toString() + "x".repeat(64));
  source = '{"items":' + JSON.stringify(values) + "}";
}
export function run(kind: i32): i32 {
  if (kind == 0) {
    JSON.parse<DynamicStrings>(source, dynamic);
    return dynamic.items.length;
  }
  JSON.parse<StaticStrings>(source, fixed);
  return fixed.items.length;
}
export function first(kind: i32): usize {
  return kind == 0
    ? changetype<usize>(dynamic.items[0])
    : changetype<usize>(fixed.items[0]);
}
