// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";

@json class Base {
  value: JSON.Lazy<i32> = 1;
}

@json class Child extends Base {

  @omit value: JSON.Lazy<i32> = 2;
  tail: i32 = 3;
}
export function run(): string {
  const out = JSON.parse<Child>('{"tail":9}');
  return (
    JSON.stringify(new Child()) +
    "|" +
    out.value.toString() +
    ":" +
    out.tail.toString()
  );
}
