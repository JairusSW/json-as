// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";


@json class DateField {
  date: Date = new Date(0);
}
let reused = new Date(0);
export function allocInput(bytes: i32): usize {
  return __new(bytes, idof<string>());
}
export function run(input: string, route: i32): i64 {
  if (route == 0) return JSON.parse<Date>(input).getTime();
  if (route == 1) {
    reused = JSON.parse<Date>(input, reused);
    return reused.getTime();
  }
  if (route == 2)
    return JSON.parse<DateField>('{"date":' + input + "}").date.getTime();
  return JSON.parse<Date[]>("[" + input + "]")[0].getTime();
}
