// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { Base, reset, count } from "./base.fixture";
const INITIAL_COUNT: i32 = 99;


@json class Child extends Base<i32> {
  tail: i32 = 9;
}
export function run(): string {
  reset();
  assert(JSON.parse<Child>("{}").value == 7);
  assert(count() == 1);
  assert(INITIAL_COUNT == 99);
  return JSON.stringify(JSON.parse<Child>('{"value":5,"tail":9}'));
}
