// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { Base } from "./lazy-private-model.fixture";

@json class Child extends Base {
  tail: i32 = 9;
}
export function run(): string {
  const out = JSON.parse<Child>('{"value":{"value":5},"tail":9}');
  assert(out.value.value == 5);
  return JSON.stringify(out);
}
