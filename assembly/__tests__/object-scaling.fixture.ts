// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
let value = new JSON.Obj();
let output = "";
export function setup(n: i32, nested: bool): void {
  value = new JSON.Obj();
  for (let i = 0; i < n; i++) value.set<i32>("k" + i.toString(), i);
  if (nested) value.set("k0", new JSON.Obj());
  output = JSON.stringify(value);
}
export function run(): i32 {
  output = JSON.stringify(value);
  return output.length;
}

export function result(): string {
  return output;
}
