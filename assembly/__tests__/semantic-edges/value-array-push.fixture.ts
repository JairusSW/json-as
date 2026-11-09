// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
let calls: i32 = 0;
class Values extends Array<JSON.Value> {
  push(_value: JSON.Value): i32 {
    calls++;
    return super.push(JSON.Value.from<i32>(99));
  }
}
export function run(): string {
  const out = JSON.parse<Values>("[1,2]");
  assert(calls == 0);
  return JSON.stringify(out);
}
