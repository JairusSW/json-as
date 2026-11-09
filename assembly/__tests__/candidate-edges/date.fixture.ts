// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";


@json
export class Date {
  value: i32 = 3;
}


@json
class Holder {
  x: Date = new Date();
}
export function run(root: bool): i32 {
  return root
    ? JSON.parse<Date>('{"value":7}').value
    : JSON.parse<Holder>('{"x":{"value":7}}').x.value;
}
