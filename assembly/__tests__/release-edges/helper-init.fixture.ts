// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON as Json } from "json-as";
const JSON: i32 = 3;


@json class Child {
  value: i32 = JSON;
}


@json class Row {
  child!: Child;
  other: i32 = JSON;
}
export function run(): string {
  return Json.stringify(Json.parse<Row>("{}"));
}
