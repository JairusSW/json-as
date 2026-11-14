// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";
class Encoder {
  stringify(value: i32): string {
    return value.toString();
  }
}


@json class Item {
  value: i32 = 7;


  @serializer("number") encode(self: Item): string {
    const JSON = new Encoder();
    return JSON.stringify(self.value);
  }
}
export function run(): string {
  return JSON.stringify(new Item());
}
