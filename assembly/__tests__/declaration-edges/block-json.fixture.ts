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
    let value: i32 = 0;
    {
      const JSON = new Encoder();
      value = <i32>parseInt(JSON.stringify(self.value));
    }
    return JSON.stringify(value);
  }
}


@json class Outer {
  before: i32 = 1;
  item: Item = new Item();
  after: i32 = 2;
}
export function run(): string {
  return JSON.stringify(new Outer());
}
