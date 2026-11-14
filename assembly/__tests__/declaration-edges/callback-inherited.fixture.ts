// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";
function callback(): i32 {
  return 7;
}
type Callback = () => i32;
class Base {
  callback: Callback = callback;
}


@json class Child extends Base {
  value: i32 = 0;
}
export function run(): string {
  const out = JSON.parse<Child>('{"value":9}');
  return out.callback().toString() + ":" + out.value.toString();
}
