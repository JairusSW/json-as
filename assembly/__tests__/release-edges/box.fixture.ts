// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
let calls: i32 = 0;
class Count extends JSON.Box<i32> {
  marker: i32 = 9;
  constructor(value: i32) {
    super(value);
    calls++;
  }
}
function check(value: Count): void {
  assert(load<u32>(changetype<usize>(value) - 8) == idof<Count>());
  assert(value.marker == 9);
}
export function run(): string {
  calls = 0;
  const out = JSON.parse<Count>("7");
  check(out);
  assert(calls == 1);
  JSON.parse<Count>("7", out);
  check(out);
  assert(calls == 1);
  const array = JSON.parse<Count[]>("[7]");
  check(array[0]);
  assert(calls == 2);
  const map = JSON.parse<Map<string, Count>>('{"x":7}');
  check(map.get("x"));
  assert(calls == 3);
  return JSON.stringify(out);
}
