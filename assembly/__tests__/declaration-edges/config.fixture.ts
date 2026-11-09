// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";

@json class Row {
  value: i32 = 7;
}
export function flags(): i32 {
  return (
    (<i32>JSON_STRICT) |
    ((<i32>JSON_DIAGNOSTICS) << 1) |
    ((<i32>isDefined(JSON_CACHE)) << 2) |
    ((<i32>isDefined(changetype<Row>(0).__DESERIALIZE_FAST)) << 3)
  );
}
export function cacheSize(): i32 {
  if (isDefined(JSON_CACHE_SIZE)) return <i32>JSON_CACHE_SIZE;
  return 0;
}
export function run(): i32 {
  return JSON.parse<Row>('{"value":9}').value;
}

export function invalid(): i32 {
  return JSON.parse<Row>('{"value":{}}').value;
}
