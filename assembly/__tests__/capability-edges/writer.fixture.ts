// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";


@json class Inner {
  value: i32 = 0;


  @serializer("object") encode(self: Inner): string {
    return '{"value":' + self.value.toString() + "}";
  }
}


@json class Outer {
  inner: Inner = new Inner();
}
export function run(reuse: bool): string {
  assert(JSON.parse<Inner>('{"value":7}').value == 7);
  return JSON.stringify(
    JSON.parse<Outer>(
      '{"inner":{"value":7}}',
      reuse ? new Outer() : changetype<Outer>(0),
    ),
  );
}
