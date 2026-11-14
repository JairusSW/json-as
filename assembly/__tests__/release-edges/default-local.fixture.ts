// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";


@json class Base<T = i32, U = T> {
  value: U = changetype<U>(0);
}


@json class Child extends Base {
  tail: i32 = 9;
}


@json class Explicit extends Base<i32> {
  tail: i32 = 9;
}
type Num<T = i32, U = T> = U;


@json class Alias {
  value: Num = 0;
}
export function run(): string {
  assert(JSON.parse<Explicit>('{"value":7,"tail":9}').value == 7);
  assert(JSON.parse<Alias>('{"value":7}').value == 7);
  return JSON.stringify(JSON.parse<Child>('{"value":7,"tail":9}'));
}
