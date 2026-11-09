// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
let source = '"2000-02-29T12:34:56.789Z"';
let value = new Date(0);
export function run(reuse: bool): void {
  value = JSON.parse<Date>(source, reuse ? value : changetype<Date>(0));
}
export function time(): i64 {
  return value.getTime();
}
