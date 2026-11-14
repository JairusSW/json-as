// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON as J } from "../index";

const JSON: i32 = 3;


@json
class Nested {
  value: i32 = 0;
  values: Array<i32> = [];
}


@json
class Outer {
  id: i32 = 0;
  child!: Nested;
}

export function read(): i32 {
  const value = J.parse<Outer>('{"id":7,"child":{"value":9,"values":[1,2]}}');
  return value.id + JSON;
}
