// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
namespace Model {
  type Numbers = Array<i32>;
  enum Kind {
    Off,
    On,
  }


  @json class Item {
    n: i32 = 3;
  }
  type ObjectAlias = Item;


  @json export class Base {
    value: Numbers = [1, 2];
    kind: Kind = Kind.On;
    item: ObjectAlias = new Item();
  }
}


@json class Child extends Model.Base {
  tail: i32 = 9;
}
export function run(): string {
  return JSON.stringify(new Child());
}
