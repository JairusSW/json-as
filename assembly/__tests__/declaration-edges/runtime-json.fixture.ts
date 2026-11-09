// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON as J } from "../../index";

@json class Item {
  value: i32 = 7;

  @serializer("number") encode(self: Item): string {
    return J.stringify(J.parse<i32>(self.value.toString()));
  }
}

@json class Outer {
  before: i32 = 1;
  item: Item = new Item();
  after: i32 = 2;
}
export function run(): string {
  return J.stringify(new Outer());
}
