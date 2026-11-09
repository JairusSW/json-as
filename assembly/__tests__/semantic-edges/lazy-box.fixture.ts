// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";

@json class Holder {
  value!: JSON.Lazy<JSON.Box<i32>>;
}

@json class Generic<T> {
  value!: JSON.Lazy<T>;
}
export function run(): string {
  assert(new Holder().value.value == 0);
  assert(JSON.parse<Generic<JSON.Box<i32>>>("{}").value.value == 0);
  assert(JSON.parse<Generic<JSON.Box<i32>>>('{"value":7}').value.value == 7);
  return JSON.stringify(JSON.parse<Holder>('{"value":7}'));
}
