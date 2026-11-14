// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";
function one(): i32 {
  type Local = i32;
  const value: Local = 7;
  return value;
}
function two(): i32 {
  type Local = string;
  const value: Local = "ok";
  return value.length;
}


@json class Row {
  value: i32 = one() + two();
}
export function run(): string {
  return JSON.stringify(new Row());
}
